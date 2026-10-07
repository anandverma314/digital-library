import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type QueryFilter } from 'mongoose';
import { addDays, toDateOnly, today } from '../common/dates.js';
import { applyPayment, extraPaymentError, type PaymentMode } from '../common/fees.js';
import { paginated } from '../common/pagination.js';
import { escapeRegex } from '../common/validation.js';
import { Payment } from '../models/payment.schema.js';
import { Student, type StudentDocument } from '../models/student.schema.js';
import { SettingsService } from '../settings/settings.service.js';
import { presentDoc } from '../students/student.presenter.js';
import { CreatePaymentDto, PaymentListQuery } from './payments.dto.js';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly payments: Model<Payment>,
    @InjectModel(Student.name) private readonly students: Model<Student>,
    private readonly settings: SettingsService,
  ) {}

  buildFilter(q: Omit<PaymentListQuery, 'page' | 'limit'>): QueryFilter<Payment> {
    const filter: QueryFilter<Payment> = {};
    if (q.studentId) filter.student = new Types.ObjectId(q.studentId);
    if (q.paymentMode) filter.paymentMode = q.paymentMode;
    if (q.feePlan) filter.feePlan = q.feePlan;
    if (q.from || q.to) {
      filter.paymentDate = {};
      if (q.from) filter.paymentDate.$gte = toDateOnly(q.from);
      if (q.to) filter.paymentDate.$lte = toDateOnly(q.to);
    }
    if (q.search?.trim()) {
      const rx = new RegExp(escapeRegex(q.search.trim()), 'i');
      filter.$or = [{ receiptNumber: rx }, { studentName: rx }, { seatNumber: rx }, { transactionId: rx }];
    }
    return filter;
  }

  async list(q: PaymentListQuery) {
    const filter = this.buildFilter(q);
    const [items, total, sum] = await Promise.all([
      this.payments
        .find(filter)
        .sort({ paymentDate: -1, createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
      this.payments.countDocuments(filter),
      this.payments.aggregate<{ total: number }>([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);
    return {
      ...paginated(items.map(presentDoc), total, q.page, q.limit),
      totalAmount: sum[0]?.total ?? 0,
    };
  }

  async get(id: string) {
    const payment = await this.payments.findById(id).lean();
    if (!payment) throw new NotFoundException('Payment not found');
    const student = await this.students
      .findById(payment.student, { name: 1, mobile: 1, email: 1, seatNumber: 1, timing: 1, status: 1 })
      .lean();
    const latest = await this.payments.findOne({ student: payment.student }).sort({ createdAt: -1 }).lean();
    return {
      ...presentDoc(payment),
      student: student ? presentDoc(student) : null,
      canDelete: String(latest?._id) === id,
    };
  }

  async create(dto: CreatePaymentDto, userId: string) {
    const student = await this.students.findById(dto.studentId);
    if (!student) throw new NotFoundException('Student not found');

    if (dto.feePlan !== student.feePlan) {
      if (dto.newFeeAmount === undefined) {
        throw new BadRequestException('Enter the new fee amount for the changed fee plan');
      }
      student.feePlan = dto.feePlan;
      student.feeAmount = dto.newFeeAmount;
    }
    if (student.feeAmount <= 0) {
      throw new BadRequestException('This student has no fee amount set. Edit the student first.');
    }

    const paymentDate = toDateOnly(dto.paymentDate);
    if (paymentDate > addDays(today(), 1)) {
      throw new BadRequestException('Payment date cannot be in the future');
    }

    const extra = extraPaymentError(student.feeCredit ?? 0, student.feeAmount, dto.amount);
    if (extra) throw new BadRequestException(extra);

    const before = {
      dueDateBefore: student.nextDueDate,
      creditBefore: student.feeCredit ?? 0,
      lastPaymentDateBefore: student.lastPaymentDate,
    };
    const applied = applyPayment(
      { nextDueDate: student.nextDueDate, feeCredit: student.feeCredit ?? 0, feeAmount: student.feeAmount, feePlan: student.feePlan },
      dto.amount,
    );
    student.nextDueDate = applied.nextDueDate;
    student.feeCredit = applied.feeCredit;
    if (!student.lastPaymentDate || paymentDate >= student.lastPaymentDate) {
      student.lastPaymentDate = paymentDate;
    }

    const payment = await this.payments.create({
      student: student._id,
      studentName: student.name,
      seatNumber: student.seatNumber,
      paymentDate,
      amount: dto.amount,
      feePlan: student.feePlan,
      paymentMode: dto.paymentMode,
      receiptNumber: await this.settings.nextReceiptNumber(),
      transactionId: dto.transactionId,
      remarks: dto.remarks,
      ...before,
      nextDueDateAfter: student.nextDueDate,
      recordedBy: new Types.ObjectId(userId),
    });
    await student.save();

    return {
      payment: presentDoc(payment.toObject()),
      periodsCovered: applied.periodsCovered,
      feeCredit: applied.feeCredit,
    };
  }

  /** Records the fee collected at admission. The due date was already set by the admission form. */
  async recordAdmissionPayment(student: StudentDocument, mode: PaymentMode, transactionId: string | undefined, userId: string) {
    return this.payments.create({
      student: student._id,
      studentName: student.name,
      seatNumber: student.seatNumber,
      paymentDate: student.admissionDate,
      amount: student.feeAmount,
      feePlan: student.feePlan,
      paymentMode: mode,
      receiptNumber: await this.settings.nextReceiptNumber(),
      transactionId,
      remarks: 'Fee paid at admission',
      dueDateBefore: student.feeStartDate,
      creditBefore: 0,
      nextDueDateAfter: student.nextDueDate,
      isAdmissionPayment: true,
      recordedBy: new Types.ObjectId(userId),
    });
  }

  /** Deletes a wrongly-entered payment. Only the student's latest payment can be removed. */
  async remove(id: string) {
    const payment = await this.payments.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    const latest = await this.payments.findOne({ student: payment.student }).sort({ createdAt: -1 });
    if (!latest || !latest._id.equals(payment._id)) {
      throw new BadRequestException('Only the most recent payment of a student can be deleted');
    }
    const student = await this.students.findById(payment.student);
    if (student && !payment.isAdmissionPayment && payment.dueDateBefore) {
      student.nextDueDate = payment.dueDateBefore;
      student.feeCredit = payment.creditBefore ?? 0;
      student.lastPaymentDate = payment.lastPaymentDateBefore;
      await student.save();
    } else if (student && payment.isAdmissionPayment) {
      // The admission fee is removed: the first period becomes unpaid again.
      student.nextDueDate = student.feeStartDate;
      student.lastPaymentDate = undefined;
      await student.save();
    }
    await payment.deleteOne();
    return { deleted: true };
  }
}
