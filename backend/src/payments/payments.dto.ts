import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FEE_PLANS, PAYMENT_MODES, type FeePlanCode, type PaymentMode } from '../common/fees.js';
import { PaginationQuery } from '../common/pagination.js';

const emptyToUndefined = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value));

export class CreatePaymentDto {
  @IsMongoId({ message: 'Select a student' })
  studentId: string;

  @IsDateString({ strict: true }, { message: 'Invalid payment date' })
  paymentDate: string;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1, { message: 'Amount must be at least ₹1' }) @Max(1_000_000)
  amount: number;

  @IsIn(FEE_PLANS)
  feePlan: FeePlanCode;

  /** Required when feePlan differs from the student's current plan. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  newFeeAmount?: number;

  @IsIn(PAYMENT_MODES)
  paymentMode: PaymentMode;

  @emptyToUndefined() @IsOptional() @IsString() @MaxLength(100)
  transactionId?: string;

  @emptyToUndefined() @IsOptional() @IsString() @MaxLength(500)
  remarks?: string;
}

export class PaymentListQuery extends PaginationQuery {
  @IsOptional() @IsMongoId()
  studentId?: string;

  @emptyToUndefined() @IsOptional() @IsDateString({ strict: true })
  from?: string;

  @emptyToUndefined() @IsOptional() @IsDateString({ strict: true })
  to?: string;

  @emptyToUndefined() @IsOptional() @IsIn(PAYMENT_MODES)
  paymentMode?: PaymentMode;

  @emptyToUndefined() @IsOptional() @IsIn(FEE_PLANS)
  feePlan?: FeePlanCode;
}
