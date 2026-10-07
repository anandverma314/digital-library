import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ADMIN_ONLY_KEY, IS_PUBLIC_KEY, type AuthUser } from '../common/decorators.js';
import { UsersService } from '../users/users.service.js';
import type { SessionPayload } from './auth.service.js';

export const SESSION_COOKIE = 'dl_session';

/** Global guard: every route needs a valid session unless marked @Public(); @AdminOnly() routes also need the admin role. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Please sign in');

    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    if (payload.purpose !== 'session') throw new UnauthorizedException('Please sign in');

    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    req.user = { id: String(user._id), email: user.email, name: user.name, role: user.role };

    const adminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [context.getHandler(), context.getClass()]);
    if (adminOnly && user.role !== 'admin') {
      throw new ForbiddenException('Only an admin can do this');
    }
    return true;
  }

  private extractToken(req: Request): string | undefined {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    if (cookie) return cookie;
    const [type, value] = req.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? value : undefined;
  }
}
