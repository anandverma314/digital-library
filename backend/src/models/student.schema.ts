import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { FEE_PLANS, type FeePlanCode } from '../common/fees.js';

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

export const STUDENT_STATUSES = ['active', 'inactive'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

@Schema({ timestamps: true })
export class Student {
  @Prop({ required: true, trim: true })
  name: string;

  /** Public path of the uploaded photo, e.g. /uploads/students/abc.webp */
  @Prop()
  photo?: string;

  @Prop({ trim: true })
  fatherName?: string;

  @Prop({ trim: true })
  motherName?: string;

  @Prop()
  dob?: Date;

  @Prop()
  age?: number;

  /** True when the admin typed an age instead of using the one calculated from DOB. */
  @Prop({ default: false })
  ageOverridden: boolean;

  @Prop({ enum: GENDERS })
  gender?: Gender;

  @Prop({ required: true, uppercase: true, trim: true })
  seatNumber: string;

  @Prop({ required: true, trim: true })
  timing: string;

  @Prop({ required: true })
  mobile: string;

  @Prop()
  guardianMobile?: string;

  @Prop({ lowercase: true, trim: true })
  email?: string;

  @Prop({ trim: true })
  address?: string;

  // ---- Fee account ----
  @Prop({ required: true, enum: FEE_PLANS })
  feePlan: FeePlanCode;

  @Prop({ required: true, min: 0 })
  feeAmount: number;

  @Prop({ required: true })
  admissionDate: Date;

  @Prop({ required: true })
  feeStartDate: Date;

  /** First day of the next unpaid period. */
  @Prop({ required: true, index: true })
  nextDueDate: Date;

  @Prop()
  lastPaymentDate?: Date;

  /** Amount paid towards the next period that did not cover a full fee yet. */
  @Prop({ default: 0, min: 0 })
  feeCredit: number;

  @Prop({ default: 'active', enum: STUDENT_STATUSES, index: true })
  status: StudentStatus;

  @Prop()
  deactivatedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export type StudentDocument = HydratedDocument<Student>;
export const StudentSchema = SchemaFactory.createForClass(Student);

// Backstop for the same seat in the same timing. Overlapping timings (e.g. Morning vs Full Day)
// are checked in StudentsService, since an index cannot compare time ranges.
StudentSchema.index(
  { seatNumber: 1, timing: 1 },
  { unique: true, partialFilterExpression: { status: 'active' }, name: 'unique_active_seat_timing' },
);
