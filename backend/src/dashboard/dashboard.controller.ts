import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { addDays, today } from '../common/dates.js';
import { FEE_STATUSES, feeStatusFilter } from '../common/fees.js';
import { Payment } from '../models/payment.schema.js';
import { Seat } from '../models/seat.schema.js';
import { Student } from '../models/student.schema.js';
import { SettingsService } from '../settings/settings.service.js';
import { presentDoc, presentStudent } from '../students/student.presenter.js';

@Controller('dashboard')
export class DashboardController {
  constructor(
    @InjectModel(Student.name) private readonly students: Model<Student>,
    @InjectModel(Payment.name) private readonly payments: Model<Payment>,
    @InjectModel(Seat.name) private readonly seats: Model<Seat>,
    private readonly settings: SettingsService,
  ) {}

  private async sum(from: Date, to?: Date) {
    const match: Record<string, unknown> = { paymentDate: to ? { $gte: from, $lt: to } : { $gte: from } };
    const [row] = await this.payments.aggregate<{ total: number; count: number }>([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    return { total: row?.total ?? 0, count: row?.count ?? 0 };
  }

  @Get()
  async get() {
    const { dueReminderDays } = await this.settings.get();
    const t = today();
    const monthStart = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
    const lastMonthStart = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
    const active = { status: 'active' as const };

    const [
      activeCount,
      inactiveCount,
      newThisMonth,
      statusCounts,
      todayTotal,
      monthTotal,
      lastMonthTotal,
      attention,
      recentPayments,
      totalSeats,
      occupiedSeats,
    ] = await Promise.all([
      this.students.countDocuments(active),
      this.students.countDocuments({ status: 'inactive' as const }),
      this.students.countDocuments({ ...active, admissionDate: { $gte: monthStart } }),
      Promise.all(FEE_STATUSES.map((s) => this.students.countDocuments({ ...active, ...feeStatusFilter(s, dueReminderDays) }))),
      this.sum(t, addDays(t, 1)),
      this.sum(monthStart),
      this.sum(lastMonthStart, monthStart),
      // Students needing attention: overdue first, then due soon.
      this.students
        .find({ ...active, nextDueDate: { $lte: addDays(t, dueReminderDays) } })
        .sort({ nextDueDate: 1 })
        .limit(8)
        .lean(),
      this.payments.find().sort({ paymentDate: -1, createdAt: -1 }).limit(8).lean(),
      this.seats.countDocuments({ isActive: true }),
      this.students.distinct('seatNumber', active),
    ]);

    return {
      students: { active: activeCount, inactive: inactiveCount, newThisMonth },
      feeStatus: Object.fromEntries(FEE_STATUSES.map((s, i) => [s, statusCounts[i]])),
      collections: { today: todayTotal, thisMonth: monthTotal, lastMonth: lastMonthTotal },
      seats: { total: totalSeats, occupied: occupiedSeats.length },
      attention: attention.map((s) => presentStudent(s, dueReminderDays)),
      recentPayments: recentPayments.map(presentDoc),
      dueReminderDays,
    };
  }
}
