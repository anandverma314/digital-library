import { Controller, Get, Query, Res } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Response } from 'express';
import { Model } from 'mongoose';
import { formatDate, toDateOnly, today } from '../common/dates.js';
import { FEE_STATUS_LABELS, PAYMENT_MODE_LABELS, PLAN_LABELS } from '../common/fees.js';
import { Payment } from '../models/payment.schema.js';
import { Student } from '../models/student.schema.js';
import { PaymentListQuery } from '../payments/payments.dto.js';
import { PaymentsService } from '../payments/payments.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { presentStudent } from '../students/student.presenter.js';

function csvCell(value: unknown): string {
  let s = String(value ?? '');
  // Prevent spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel opens ₹ and Hindi names correctly.
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

@Controller('reports')
export class ReportsController {
  constructor(
    @InjectModel(Payment.name) private readonly payments: Model<Payment>,
    @InjectModel(Student.name) private readonly students: Model<Student>,
    private readonly paymentsService: PaymentsService,
    private readonly settings: SettingsService,
  ) {}

  /** Collection summary for a date range (defaults to the current year). */
  @Get('summary')
  async summary(@Query('from') fromStr?: string, @Query('to') toStr?: string) {
    const t = today();
    const from = fromStr ? toDateOnly(fromStr) : new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const to = toStr ? toDateOnly(toStr) : t;
    const match = { paymentDate: { $gte: from, $lte: to } };

    const group = (key: unknown) =>
      this.payments.aggregate<{ _id: string; total: number; count: number }>([
        { $match: match },
        { $group: { _id: key, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

    const [byMonth, byMode, byPlan] = await Promise.all([
      group({ $dateToString: { format: '%Y-%m', date: '$paymentDate' } }),
      group('$paymentMode'),
      group('$feePlan'),
    ]);
    const total = byMode.reduce((a, r) => a + r.total, 0);
    const count = byMode.reduce((a, r) => a + r.count, 0);
    return {
      from,
      to,
      total,
      count,
      byMonth: byMonth.map((r) => ({ month: r._id, total: r.total, count: r.count })),
      byMode: byMode.map((r) => ({ mode: r._id, total: r.total, count: r.count })),
      byPlan: byPlan.map((r) => ({ plan: r._id, total: r.total, count: r.count })),
    };
  }

  @Get('payments.csv')
  async paymentsCsv(@Query() q: PaymentListQuery, @Res() res: Response) {
    const rows = await this.payments.find(this.paymentsService.buildFilter(q)).sort({ paymentDate: -1 }).lean();
    const csv = toCsv(
      ['Date', 'Receipt No.', 'Student', 'Seat', 'Amount', 'Mode', 'Fee Plan', 'Transaction ID', 'Next Due', 'Remarks'],
      rows.map((p) => [
        formatDate(p.paymentDate),
        p.receiptNumber,
        p.studentName,
        p.seatNumber,
        p.amount,
        PAYMENT_MODE_LABELS[p.paymentMode],
        PLAN_LABELS[p.feePlan],
        p.transactionId,
        formatDate(p.nextDueDateAfter),
        p.remarks,
      ]),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payments-${formatDate(today())}.csv"`);
    res.send(csv);
  }

  @Get('students.csv')
  async studentsCsv(@Query('status') status: string | undefined, @Res() res: Response) {
    const { dueReminderDays } = await this.settings.get();
    const filter = status === 'all' ? {} : { status: status === 'inactive' ? ('inactive' as const) : ('active' as const) };
    const docs = await this.students.find(filter).collation({ locale: 'en', numericOrdering: true }).sort({ seatNumber: 1 }).lean();
    const csv = toCsv(
      ['Name', 'Seat', 'Timing', 'Mobile', 'Guardian', 'Email', 'Fee Plan', 'Fee Amount', 'Next Due', 'Fee Status', 'Status', 'Admission Date'],
      docs.map((d) => {
        const s = presentStudent(d, dueReminderDays);
        return [
          s.name,
          s.seatNumber,
          s.timing,
          s.mobile,
          s.guardianMobile,
          s.email,
          PLAN_LABELS[s.feePlan],
          s.feeAmount,
          formatDate(s.nextDueDate),
          FEE_STATUS_LABELS[s.feeStatus],
          s.status,
          formatDate(s.admissionDate),
        ];
      }),
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="students-${formatDate(today())}.csv"`);
    res.send(csv);
  }
}
