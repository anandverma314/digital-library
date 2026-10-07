import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ageFromDob, toDateOnly } from '../common/dates.js';
import { feeStatusFilter, nextDueFrom } from '../common/fees.js';
import { paginated } from '../common/pagination.js';
import { escapeRegex, normalizeMobile } from '../common/validation.js';
import { Payment } from '../models/payment.schema.js';
import { Student, type StudentDocument } from '../models/student.schema.js';
import { Timing } from '../models/timing.schema.js';
import { PaymentsService } from '../payments/payments.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { deletePhoto, photoPath, savePhoto } from './photo-storage.js';
import { presentStudent } from './student.presenter.js';
import { CreateStudentDto, StudentBaseDto, StudentListQuery, UpdateStudentDto } from './students.dto.js';

@Injectable()
export class StudentsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectModel(Student.name) private readonly students: Model<Student>,
    @InjectModel(Payment.name) private readonly payments: Model<Payment>,
    @InjectModel(Timing.name) private readonly timings: Model<Timing>,
    private readonly paymentsService: PaymentsService,
    private readonly settings: SettingsService,
  ) {}

  /** Seats used to be unique per active student; drop that index so seats can be shared across timings. */
  async onApplicationBootstrap() {
    try {
      if (await this.students.collection.indexExists('unique_active_seat')) {
        await this.students.collection.dropIndex('unique_active_seat');
        this.logger.log('Dropped old index unique_active_seat (seats are now unique per timing)');
      }
    } catch {
      // The collection does not exist yet on a fresh database - nothing to drop.
    }
  }

  private async dueWindow() {
    return (await this.settings.get()).dueReminderDays;
  }

  async list(q: StudentListQuery) {
    const window = await this.dueWindow();
    const filter: Record<string, unknown> = {};
    if (q.status !== 'all') filter.status = q.status;
    if (q.timing) filter.timing = q.timing;
    if (q.feePlan) filter.feePlan = q.feePlan;
    if (q.feeStatus) Object.assign(filter, feeStatusFilter(q.feeStatus, window));
    if (q.search?.trim()) {
      const rx = new RegExp(escapeRegex(q.search.trim()), 'i');
      filter.$or = [{ name: rx }, { seatNumber: rx }, { mobile: rx }, { guardianMobile: rx }, { email: rx }, { fatherName: rx }];
    }
    const sort: Record<string, 1 | -1> =
      q.sort === 'createdAt' ? { createdAt: -1 } : { [q.sort]: 1, _id: 1 };

    const [docs, total] = await Promise.all([
      this.students
        .find(filter)
        .collation({ locale: 'en', numericOrdering: true })
        .sort(sort)
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
      this.students.countDocuments(filter),
    ]);
    return paginated(docs.map((d) => presentStudent(d, window)), total, q.page, q.limit);
  }

  async get(id: string) {
    const doc = await this.students.findById(id).lean();
    if (!doc) throw new NotFoundException('Student not found');
    return presentStudent(doc, await this.dueWindow());
  }

  async create(dto: CreateStudentDto, photo: Express.Multer.File | undefined, userId: string) {
    const seatNumber = dto.seatNumber.toUpperCase();
    await this.assertTimingExists(dto.timing);
    await this.assertSeatFree(seatNumber, dto.timing);

    const feeStartDate = toDateOnly(dto.feeStartDate);
    const recordInitial = dto.recordInitialPayment === true && dto.feeAmount > 0;
    // If the first fee is collected now, the next due date is one period after the start; otherwise the fee is due at the start.
    const nextDueDate = dto.nextDueDate
      ? toDateOnly(dto.nextDueDate)
      : recordInitial
        ? nextDueFrom(feeStartDate, dto.feePlan)
        : feeStartDate;

    // Validate & store the photo before creating, so a bad file never leaves a half-saved student.
    const photoName = photo ? await savePhoto(photo) : undefined;

    let student: StudentDocument;
    try {
      student = await this.students.create({
        ...this.personalFields(dto),
        seatNumber,
        photo: photoName,
        feePlan: dto.feePlan,
        feeAmount: dto.feeAmount,
        admissionDate: toDateOnly(dto.admissionDate),
        feeStartDate,
        nextDueDate,
        lastPaymentDate: recordInitial ? toDateOnly(dto.admissionDate) : undefined,
        feeCredit: 0,
        status: 'active',
      });
    } catch (e) {
      await deletePhoto(photoName);
      throw this.mapDuplicate(e, seatNumber);
    }

    let initialPayment: { receiptNumber: string } | null = null;
    if (recordInitial) {
      try {
        const p = await this.paymentsService.recordAdmissionPayment(
          student,
          dto.initialPaymentMode ?? 'cash',
          dto.initialTransactionId,
          userId,
        );
        initialPayment = { receiptNumber: p.receiptNumber };
      } catch (e) {
        this.logger.error(`Student ${student._id} saved but admission payment failed: ${e}`);
      }
    }

    return {
      student: presentStudent(student.toObject(), await this.dueWindow()),
      initialPayment,
    };
  }

  async update(id: string, dto: UpdateStudentDto, photo: Express.Multer.File | undefined) {
    const student = await this.students.findById(id);
    if (!student) throw new NotFoundException('Student not found');

    const seatNumber = dto.seatNumber.toUpperCase();
    if (dto.timing !== student.timing) await this.assertTimingExists(dto.timing);
    if (student.status === 'active' && (seatNumber !== student.seatNumber || dto.timing !== student.timing)) {
      await this.assertSeatFree(seatNumber, dto.timing, id);
    }

    const newPhoto = photo ? await savePhoto(photo) : undefined;
    const oldPhoto = student.photo;

    student.set({
      ...this.personalFields(dto),
      seatNumber,
      feePlan: dto.feePlan,
      feeAmount: dto.feeAmount,
      admissionDate: toDateOnly(dto.admissionDate),
      feeStartDate: toDateOnly(dto.feeStartDate),
      ...(dto.nextDueDate ? { nextDueDate: toDateOnly(dto.nextDueDate) } : {}),
    });
    if (newPhoto) student.photo = newPhoto;
    else if (dto.removePhoto) student.photo = undefined;

    try {
      await student.save();
    } catch (e) {
      await deletePhoto(newPhoto);
      throw this.mapDuplicate(e, seatNumber);
    }
    if ((newPhoto || dto.removePhoto) && oldPhoto) await deletePhoto(oldPhoto);

    return presentStudent(student.toObject(), await this.dueWindow());
  }

  async setStatus(id: string, status: 'active' | 'inactive') {
    const student = await this.students.findById(id);
    if (!student) throw new NotFoundException('Student not found');
    if (student.status === status) return presentStudent(student.toObject(), await this.dueWindow());

    if (status === 'active') {
      await this.assertSeatFree(student.seatNumber, student.timing, id);
      student.deactivatedAt = undefined;
    } else {
      student.deactivatedAt = new Date();
    }
    student.status = status;
    try {
      await student.save();
    } catch (e) {
      throw this.mapDuplicate(e, student.seatNumber);
    }
    return presentStudent(student.toObject(), await this.dueWindow());
  }

  /** Permanently deletes a student. Students with payments must be deactivated instead, to keep financial records. */
  async remove(id: string) {
    const student = await this.students.findById(id);
    if (!student) throw new NotFoundException('Student not found');
    const paymentCount = await this.payments.countDocuments({ student: student._id });
    if (paymentCount > 0) {
      throw new BadRequestException(
        `This student has ${paymentCount} payment record(s). Deactivate the student instead so the payment history is kept.`,
      );
    }
    await student.deleteOne();
    await deletePhoto(student.photo);
    return { deleted: true };
  }

  async photoFile(id: string): Promise<string> {
    const student = await this.students.findById(id, { photo: 1 }).lean();
    const path = student?.photo ? photoPath(student.photo) : null;
    if (!path) throw new NotFoundException('No photo');
    return path;
  }

  private personalFields(dto: StudentBaseDto) {
    const dob = dto.dob ? toDateOnly(dto.dob) : undefined;
    const ageOverridden = dto.ageOverridden === true && dto.age !== undefined;
    return {
      name: dto.name,
      fatherName: dto.fatherName,
      motherName: dto.motherName,
      dob,
      age: ageOverridden ? dto.age : dob ? ageFromDob(dob) : dto.age,
      ageOverridden: ageOverridden || (!dob && dto.age !== undefined),
      gender: dto.gender,
      timing: dto.timing,
      mobile: normalizeMobile(dto.mobile),
      guardianMobile: dto.guardianMobile ? normalizeMobile(dto.guardianMobile) : undefined,
      email: dto.email?.toLowerCase(),
      address: dto.address,
    };
  }

  /** A seat can be shared only by active students whose timings do not overlap. */
  private async assertSeatFree(seatNumber: string, timing: string, exceptId?: string) {
    const filter: Record<string, unknown> = {
      seatNumber,
      status: 'active',
      timing: { $in: await this.settings.clashingTimings(timing) },
    };
    if (exceptId) filter._id = { $ne: exceptId };
    const holder = await this.students.findOne(filter, { name: 1, timing: 1 }).lean();
    if (!holder) return;
    throw new ConflictException(
      holder.timing === timing
        ? `Seat ${seatNumber} is already assigned to ${holder.name} in the ${timing} timing`
        : `Seat ${seatNumber} is already assigned to ${holder.name} in ${holder.timing}, which overlaps ${timing}`,
    );
  }

  private async assertTimingExists(name: string) {
    if (!(await this.timings.exists({ name }))) {
      throw new BadRequestException(`Unknown timing "${name}". Add it under Settings → Timings first.`);
    }
  }

  private mapDuplicate(e: unknown, seatNumber: string): unknown {
    if (typeof e === 'object' && e && (e as { code?: number }).code === 11000) {
      return new ConflictException(`Seat ${seatNumber} is already assigned to another active student in this timing`);
    }
    return e;
  }
}
