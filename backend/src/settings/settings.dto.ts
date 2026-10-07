import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { FEE_PLANS, type FeePlanCode } from '../common/fees.js';

export class UpdateSettingsDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  libraryName?: string;

  @IsOptional() @IsString() @MaxLength(30)
  contactPhone?: string;

  @IsOptional() @ValidateIf((o) => o.contactEmail !== '') @IsEmail()
  contactEmail?: string;

  @IsOptional() @IsString() @MaxLength(500)
  address?: string;

  @IsOptional() @IsString() @Matches(/^[A-Z0-9]{1,10}$/, { message: 'Receipt prefix: 1-10 capital letters/digits' })
  receiptPrefix?: string;

  @IsOptional() @IsInt() @Min(0) @Max(60)
  dueReminderDays?: number;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class TimingDto {
  @IsString() @IsNotEmpty() @MaxLength(50)
  name: string;

  @IsOptional() @ValidateIf((o) => o.startTime !== '') @Matches(TIME, { message: 'Start time must be HH:MM' })
  startTime?: string;

  @IsOptional() @ValidateIf((o) => o.endTime !== '') @Matches(TIME, { message: 'End time must be HH:MM' })
  endTime?: string;

  @IsOptional() @IsInt()
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class SeatDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  number: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

/** Adds a range of seats at once, e.g. prefix "A", from 1 to 20 -> A-01 ... A-20 */
export class SeatRangeDto {
  @IsString() @Matches(/^[A-Za-z0-9]{1,5}$/)
  prefix: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(999)
  from: number;

  @Type(() => Number) @IsInt() @Min(1) @Max(999)
  to: number;
}

export class FeePlanDto {
  @IsIn(FEE_PLANS)
  code: FeePlanCode;

  @IsNumber() @Min(0)
  defaultAmount: number;
}
