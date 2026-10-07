import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { FEE_PLANS, PAYMENT_MODES, type FeePlanCode, type PaymentMode } from '../common/fees.js';

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
  student: Types.ObjectId;

  // Snapshots so receipts stay correct even if the student is edited later.
  @Prop({ required: true })
  studentName: string;

  @Prop({ required: true })
  seatNumber: string;

  @Prop({ required: true, index: true })
  paymentDate: Date;

  @Prop({ required: true, min: 1 })
  amount: number;

  @Prop({ required: true, enum: FEE_PLANS })
  feePlan: FeePlanCode;

  @Prop({ required: true, enum: PAYMENT_MODES })
  paymentMode: PaymentMode;

  /** Library-generated receipt number, e.g. SSSP-00123 */
  @Prop({ required: true, unique: true })
  receiptNumber: string;

  /** UPI/bank transaction reference, if any. */
  @Prop({ trim: true })
  transactionId?: string;

  @Prop({ trim: true })
  remarks?: string;

  // Student's fee account before this payment - lets the latest payment be reversed.
  @Prop()
  dueDateBefore?: Date;

  @Prop({ default: 0 })
  creditBefore: number;

  @Prop()
  lastPaymentDateBefore?: Date;

  /** True for the payment recorded together with the admission (does not move the due date). */
  @Prop({ default: false })
  isAdmissionPayment: boolean;

  @Prop()
  nextDueDateAfter?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  recordedBy?: Types.ObjectId;

  createdAt: Date;
}

export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);
