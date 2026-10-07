import { IsEmail, IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../common/validation.js';

export class LoginDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @IsString() @IsNotEmpty() @MaxLength(72)
  password: string;
}

export class ChangePasswordDto {
  @IsString() @IsNotEmpty() @MaxLength(72)
  currentPassword: string;

  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class UpdateProfileDto {
  @IsString() @Length(2, 80)
  name: string;
}
