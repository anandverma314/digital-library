import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FEE_PLANS, FEE_STATUSES, PAYMENT_MODES, type FeePlanCode, type FeeStatus, type PaymentMode } from '../common/fees.js';
import { PaginationQuery } from '../common/pagination.js';
import { INDIAN_MOBILE_REGEX } from '../common/validation.js';
import { GENDERS, type Gender } from '../models/student.schema.js';

const MOBILE_MSG = 'Enter a valid 10-digit Indian mobile number';
const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
/** Empty strings from the form are treated as "not provided". */
const emptyToUndefined = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value));

export class StudentBaseDto {
  @trim() @IsString() @Length(2, 100, { message: 'Student name must be 2-100 characters' })
  name: string;

  @emptyToUndefined() @IsOptional() @trim() @IsString() @MaxLength(100)
  fatherName?: string;

  @emptyToUndefined() @IsOptional() @trim() @IsString() @MaxLength(100)
  motherName?: string;

  @emptyToUndefined() @IsOptional() @IsDateString({ strict: true }, { message: 'Invalid date of birth' })
  dob?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(3) @Max(100)
  age?: number;

  @IsOptional() @IsBoolean()
  ageOverridden?: boolean;

  @emptyToUndefined() @IsOptional() @IsIn(GENDERS)
  gender?: Gender;

  @trim() @IsString() @IsNotEmpty({ message: 'Seat number is required' })
  @Matches(/^[A-Za-z0-9-]{1,20}$/, { message: 'Seat number may contain letters, digits and "-" only (e.g. A-01)' })
  seatNumber: string;

  @trim() @IsString() @IsNotEmpty({ message: 'Timing is required' })
  timing: string;

  @trim() @Matches(INDIAN_MOBILE_REGEX, { message: MOBILE_MSG })
  mobile: string;

  @emptyToUndefined() @IsOptional() @trim() @Matches(INDIAN_MOBILE_REGEX, { message: 'Enter a valid guardian phone number' })
  guardianMobile?: string;

  @emptyToUndefined() @IsOptional() @trim() @IsEmail({}, { message: 'Enter a valid email address' })
  email?: string;

  @emptyToUndefined() @IsOptional() @trim() @IsString() @MaxLength(500)
  address?: string;

  @IsIn(FEE_PLANS)
  feePlan: FeePlanCode;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000)
  feeAmount: number;

  @IsDateString({ strict: true }, { message: 'Invalid admission date' })
  admissionDate: string;

  @IsDateString({ strict: true }, { message: 'Invalid fee start date' })
  feeStartDate: string;

  @emptyToUndefined() @IsOptional() @IsDateString({ strict: true }, { message: 'Invalid next due date' })
  nextDueDate?: string;
}

export class CreateStudentDto extends StudentBaseDto {
  /** Record the first period's fee as paid now (next due = start + plan). */
  @IsOptional() @IsBoolean()
  recordInitialPayment?: boolean;

  @IsOptional() @IsIn(PAYMENT_MODES)
  initialPaymentMode?: PaymentMode;

  @emptyToUndefined() @IsOptional() @trim() @IsString() @MaxLength(100)
  initialTransactionId?: string;
}

export class UpdateStudentDto extends StudentBaseDto {
  @IsOptional() @IsBoolean()
  removePhoto?: boolean;
}

export class StudentListQuery extends PaginationQuery {
  @IsOptional() @IsIn(['active', 'inactive', 'all'])
  status: 'active' | 'inactive' | 'all' = 'active';

  @IsOptional() @IsString()
  timing?: string;

  @IsOptional() @IsIn(FEE_PLANS)
  feePlan?: FeePlanCode;

  @IsOptional() @IsIn(FEE_STATUSES)
  feeStatus?: FeeStatus;

  @IsOptional() @IsIn(['name', 'seatNumber', 'nextDueDate', 'createdAt'])
  sort: 'name' | 'seatNumber' | 'nextDueDate' | 'createdAt' = 'createdAt';
}
