import { Body, Controller, Get, HttpCode, Post, Put, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { CurrentUser, Public, type AuthUser } from '../common/decorators.js';
import type { UserDocument } from '../models/user.schema.js';
import { UsersService } from '../users/users.service.js';
import { ChangePasswordDto, LoginDto, UpdateProfileDto } from './auth.dto.js';
import { SESSION_COOKIE } from './auth.guard.js';
import { AuthService, publicUser } from './auth.service.js';

/** Strict limit for endpoints that check passwords. */
const STRICT = { default: { limit: 10, ttl: 60_000 } };

function parseDurationMs(value: string): number {
  const m = /^(\d+)([smhd])$/.exec(value);
  if (!m) return 8 * 3600_000;
  const unit = { s: 1000, m: 60_000, h: 3600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
  return Number(m[1]) * unit;
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: parseDurationMs(process.env.JWT_EXPIRES_IN || '8h'),
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  private async startSession(res: Response, user: UserDocument) {
    const token = await this.auth.createSession(user);
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    return { user: publicUser(user) };
  }

  @Public()
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto.email, dto.password);
    return this.startSession(res, user);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    const { maxAge: _maxAge, ...opts } = cookieOptions();
    res.clearCookie(SESSION_COOKIE, opts);
    return { message: 'Signed out' };
  }

  @Get('me')
  async me(@CurrentUser() current: AuthUser) {
    const user = await this.users.findById(current.id);
    return { user: user ? publicUser(user) : current };
  }

  @Put('profile')
  async updateProfile(@CurrentUser() current: AuthUser, @Body() dto: UpdateProfileDto) {
    return { user: publicUser(await this.auth.updateProfile(current.id, dto.name)) };
  }

  @Throttle(STRICT)
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() current: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.changePassword(current.id, dto.currentPassword, dto.newPassword);
    await this.startSession(res, user);
    return { message: 'Password changed successfully' };
  }
}
