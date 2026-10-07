import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../common/validation.js';
import { USER_ROLES, type UserRole } from '../models/user.schema.js';

export class CreateUserDto {
  @IsString() @Length(2, 80)
  name: string;

  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @IsIn(USER_ROLES)
  role: UserRole;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @Length(2, 80)
  name?: string;

  @IsOptional() @IsIn(USER_ROLES)
  role?: UserRole;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class SetPasswordDto {
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;
}
