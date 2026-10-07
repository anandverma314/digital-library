import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '../models/user.schema.js';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as accessible without logging in. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ADMIN_ONLY_KEY = 'adminOnly';
/** Restricts a route (or a whole controller) to admins. */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY_KEY, true);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
