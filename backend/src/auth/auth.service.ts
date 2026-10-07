import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { UserDocument } from '../models/user.schema.js';
import { hashPassword, UsersService, verifyPassword } from '../users/users.service.js';

export interface SessionPayload {
  sub: string;
  tv: number;
  purpose: 'session';
}

export function publicUser(user: UserDocument) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmailWithPassword(email);
    // Same message for unknown email and wrong password, so accounts cannot be probed.
    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  async createSession(user: UserDocument): Promise<string> {
    user.lastLoginAt = new Date();
    await user.save();
    return this.jwt.signAsync({ sub: String(user._id), tv: user.tokenVersion, purpose: 'session' } satisfies SessionPayload);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.users.findByIdWithPassword(userId);
    if (!user) throw new UnauthorizedException();
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }
    user.passwordHash = await hashPassword(newPassword);
    user.tokenVersion += 1; // other devices are logged out; this one gets a fresh session
    await user.save();
    return user;
  }

  async updateProfile(userId: string, name: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    user.name = name.trim();
    await user.save();
    return user;
  }

}
