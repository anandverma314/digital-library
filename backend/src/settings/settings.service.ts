import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FEE_PLANS, PLAN_LABELS, PLAN_MONTHS } from '../common/fees.js';
import { timingsOverlap, type TimingSlot } from '../common/timings.js';
import { Counter } from '../models/counter.schema.js';
import { FeePlan } from '../models/fee-plan.schema.js';
import { Seat } from '../models/seat.schema.js';
import { Setting } from '../models/setting.schema.js';
import { Student } from '../models/student.schema.js';
import { Timing } from '../models/timing.schema.js';
import { FeePlanDto, SeatDto, SeatRangeDto, TimingDto, UpdateSettingsDto } from './settings.dto.js';

const DEFAULT_TIMINGS = [
  { name: 'Morning', startTime: '06:00', endTime: '12:00', sortOrder: 1 },
  { name: 'Afternoon', startTime: '12:00', endTime: '17:00', sortOrder: 2 },
  { name: 'Evening', startTime: '17:00', endTime: '22:00', sortOrder: 3 },
  { name: 'Full Day', startTime: '06:00', endTime: '22:00', sortOrder: 4 },
];
const DEFAULT_PLAN_AMOUNTS = { monthly: 1000, half_yearly: 5500, yearly: 10000 };

@Injectable()
export class SettingsService implements OnApplicationBootstrap {
  constructor(
    @InjectModel(Setting.name) private readonly settings: Model<Setting>,
    @InjectModel(Timing.name) private readonly timings: Model<Timing>,
    @InjectModel(Seat.name) private readonly seats: Model<Seat>,
    @InjectModel(FeePlan.name) private readonly feePlans: Model<FeePlan>,
    @InjectModel(Counter.name) private readonly counters: Model<Counter>,
    @InjectModel(Student.name) private readonly students: Model<Student>,
  ) {}

  /** Creates default settings, timings and fee plans on first start. */
  async onApplicationBootstrap() {
    await this.get();
    if ((await this.timings.estimatedDocumentCount()) === 0) {
      await this.timings.insertMany(DEFAULT_TIMINGS);
    }
    for (const code of FEE_PLANS) {
      await this.feePlans.updateOne(
        { code },
        {
          $setOnInsert: {
            code,
            label: PLAN_LABELS[code],
            months: PLAN_MONTHS[code],
            defaultAmount: DEFAULT_PLAN_AMOUNTS[code],
          },
        },
        { upsert: true },
      );
    }
  }

  // ---- Library settings ----
  async get(): Promise<Setting> {
    const doc = await this.settings.findOneAndUpdate(
      {},
      { $setOnInsert: {} },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return doc.toObject();
  }

  async update(dto: UpdateSettingsDto): Promise<Setting> {
    const doc = await this.settings.findOneAndUpdate({}, { $set: dto }, { upsert: true, returnDocument: 'after' });
    return doc.toObject();
  }

  /** Next receipt number, e.g. SSSP-00042. Atomic, so concurrent payments never collide. */
  async nextReceiptNumber(): Promise<string> {
    const { receiptPrefix } = await this.get();
    const counter = await this.counters.findOneAndUpdate(
      { key: 'receipt' },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    return `${receiptPrefix}-${String(counter.value).padStart(5, '0')}`;
  }

  // ---- Timings ----
  listTimings(activeOnly = false) {
    return this.timings.find(activeOnly ? { isActive: true } : {}).sort({ sortOrder: 1, name: 1 }).lean();
  }

  async createTiming(dto: TimingDto) {
    try {
      return await this.timings.create(dto);
    } catch (e) {
      throw this.duplicate(e, 'A timing with this name already exists');
    }
  }

  async updateTiming(id: string, dto: TimingDto) {
    const existing = await this.timings.findById(id);
    if (!existing) throw new NotFoundException('Timing not found');
    const oldName = existing.name;
    await this.assertNoSeatClash(oldName, { name: dto.name, startTime: dto.startTime, endTime: dto.endTime });
    Object.assign(existing, dto);
    try {
      await existing.save();
    } catch (e) {
      throw this.duplicate(e, 'A timing with this name already exists');
    }
    // Keep students pointing at the renamed timing.
    if (oldName !== existing.name) {
      await this.students.updateMany({ timing: oldName }, { $set: { timing: existing.name } });
    }
    return existing;
  }

  /**
   * New hours for a timing must not overlap the timing of anyone already sharing a seat
   * with its students (e.g. stretching Morning to 06:00-18:00 while its seats are shared with Afternoon).
   */
  private async assertNoSeatClash(oldName: string, updated: TimingSlot) {
    const own = await this.students.find({ timing: oldName, status: 'active' }, { seatNumber: 1, name: 1 }).lean();
    if (own.length === 0) return;
    const others = await this.students
      .find(
        { seatNumber: { $in: own.map((s) => s.seatNumber) }, timing: { $ne: oldName }, status: 'active' },
        { seatNumber: 1, name: 1, timing: 1 },
      )
      .lean();
    if (others.length === 0) return;

    const timings = new Map((await this.timings.find().lean()).map((t) => [t.name, t]));
    const clashes = others
      .filter((o) => timingsOverlap(updated, timings.get(o.timing) ?? { name: o.timing }))
      .map((o) => {
        const mine = own.find((s) => s.seatNumber === o.seatNumber)!;
        return `seat ${o.seatNumber}: ${mine.name} and ${o.name} (${o.timing})`;
      });
    if (clashes.length > 0) {
      const shown = clashes.slice(0, 3).join('; ');
      const more = clashes.length > 3 ? ` and ${clashes.length - 3} more` : '';
      throw new ConflictException(
        `These hours overlap students who share a seat - ${shown}${more}. Move one of them to another seat first.`,
      );
    }
  }

  async deleteTiming(id: string) {
    const timing = await this.timings.findById(id);
    if (!timing) throw new NotFoundException('Timing not found');
    const inUse = await this.students.countDocuments({ timing: timing.name, status: 'active' });
    if (inUse > 0) {
      throw new BadRequestException(
        `${inUse} active student(s) use this timing. Mark it inactive instead, or move those students first.`,
      );
    }
    await timing.deleteOne();
    return { deleted: true };
  }

  // ---- Seats ----
  async listSeats() {
    const [seats, occupied] = await Promise.all([
      this.seats.find().lean(),
      this.students.find({ status: 'active' }, { seatNumber: 1, name: 1, timing: 1 }).sort({ name: 1 }).lean(),
    ]);
    // One seat can be shared by students in non-overlapping timings.
    const bySeat = new Map<string, { id: string; name: string; timing: string }[]>();
    for (const s of occupied) {
      const list = bySeat.get(s.seatNumber) ?? [];
      list.push({ id: String(s._id), name: s.name, timing: s.timing });
      bySeat.set(s.seatNumber, list);
    }
    return seats
      .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
      .map((s) => ({ ...s, occupiedBy: bySeat.get(s.number) ?? [] }));
  }

  /** Names of all timings that clash with `timing` (including itself). */
  async clashingTimings(timing: string): Promise<string[]> {
    const all = await this.timings.find({}, { name: 1, startTime: 1, endTime: 1 }).lean();
    const self = all.find((t) => t.name === timing) ?? { name: timing };
    return all.filter((t) => timingsOverlap(self, t)).map((t) => t.name).concat(timing);
  }

  /**
   * Active seats that are free for `timing`: not held by an active student in a clashing timing
   * (excluding `exceptStudentId`, for edits). Without a timing, any active student makes a seat taken.
   */
  async availableSeats(exceptStudentId?: string, timing?: string) {
    const filter: Record<string, unknown> = { status: 'active' };
    if (exceptStudentId) filter._id = { $ne: exceptStudentId };
    if (timing) filter.timing = { $in: await this.clashingTimings(timing) };
    const taken = new Set(await this.students.distinct('seatNumber', filter));
    const seats = await this.seats.find({ isActive: true }).lean();
    return seats
      .map((s) => s.number)
      .filter((n) => !taken.has(n))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  async createSeat(dto: SeatDto) {
    try {
      return await this.seats.create({ ...dto, number: dto.number.trim().toUpperCase() });
    } catch (e) {
      throw this.duplicate(e, 'This seat already exists');
    }
  }

  async createSeatRange(dto: SeatRangeDto) {
    if (dto.to < dto.from) throw new BadRequestException('"To" must be greater than or equal to "From"');
    if (dto.to - dto.from > 300) throw new BadRequestException('You can add at most 300 seats at a time');
    const width = Math.max(2, String(dto.to).length);
    const prefix = dto.prefix.toUpperCase();
    const ops = [];
    for (let i = dto.from; i <= dto.to; i++) {
      const number = `${prefix}-${String(i).padStart(width, '0')}`;
      ops.push({ updateOne: { filter: { number }, update: { $setOnInsert: { number, isActive: true } }, upsert: true } });
    }
    const res = await this.seats.bulkWrite(ops);
    return { created: res.upsertedCount, skipped: ops.length - res.upsertedCount };
  }

  async updateSeat(id: string, dto: SeatDto) {
    try {
      const seat = await this.seats.findByIdAndUpdate(
        id,
        { ...dto, number: dto.number.trim().toUpperCase() },
        { returnDocument: 'after', runValidators: true },
      );
      if (!seat) throw new NotFoundException('Seat not found');
      return seat;
    } catch (e) {
      throw this.duplicate(e, 'This seat already exists');
    }
  }

  async deleteSeat(id: string) {
    const seat = await this.seats.findByIdAndDelete(id);
    if (!seat) throw new NotFoundException('Seat not found');
    return { deleted: true };
  }

  // ---- Fee plans ----
  async listFeePlans() {
    const plans = await this.feePlans.find().lean();
    return plans.sort((a, b) => a.months - b.months);
  }

  async updateFeePlans(plans: FeePlanDto[]) {
    for (const p of plans) {
      await this.feePlans.updateOne({ code: p.code }, { $set: { defaultAmount: p.defaultAmount } });
    }
    return this.listFeePlans();
  }

  private duplicate(e: unknown, message: string): unknown {
    if (typeof e === 'object' && e && (e as { code?: number }).code === 11000) {
      return new ConflictException(message);
    }
    return e;
  }
}
