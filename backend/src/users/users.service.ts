import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { User, type UserDocument } from '../models/user.schema.js';
import type { CreateUserDto, UpdateUserDto } from './users.dto.js';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  /** Creates the first admin from ADMIN_* env vars when the database has no users. */
  async onApplicationBootstrap() {
    // The old "staff" role is now called "user".
    await this.users.collection.updateMany({ role: 'staff' }, { $set: { role: 'user' } });
    if ((await this.users.estimatedDocumentCount()) > 0) return;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      this.logger.warn('No users exist and ADMIN_EMAIL/ADMIN_PASSWORD are not set - nobody can log in.');
      return;
    }
    await this.users.create({
      name: process.env.ADMIN_NAME || 'Library Admin',
      email,
      passwordHash: await hashPassword(password),
      role: 'admin',
    });
    this.logger.log(`Created first admin account: ${email}`);
  }

  findByEmailWithPassword(email: string) {
    return this.users.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  }

  findByIdWithPassword(id: string) {
    return this.users.findById(id).select('+passwordHash');
  }

  findById(id: string) {
    return this.users.findById(id);
  }

  findByEmail(email: string) {
    return this.users.findOne({ email: email.toLowerCase().trim() });
  }

  async list() {
    const users = await this.users.find().sort({ role: 1, name: 1 });
    return users.map(presentUser);
  }

  async create(dto: CreateUserDto) {
    if (await this.findByEmail(dto.email)) throw new ConflictException('A user with this email already exists');
    const user = await this.users.create({
      name: dto.name.trim(),
      email: dto.email,
      passwordHash: await hashPassword(dto.password),
      role: dto.role,
    });
    return presentUser(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (id === actorId && (dto.role === 'user' || dto.isActive === false)) {
      throw new BadRequestException('You cannot remove your own admin access or deactivate yourself');
    }
    const losesAdmin = user.role === 'admin' && user.isActive && (dto.role === 'user' || dto.isActive === false);
    if (losesAdmin && (await this.users.countDocuments({ role: 'admin', isActive: true })) <= 1) {
      throw new BadRequestException('There must always be at least one active admin');
    }
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    await user.save();
    return presentUser(user);
  }

  /** Admin sets a new password for a user; their existing sessions are signed out. */
  async setPassword(id: string, password: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found');
    user.passwordHash = await hashPassword(password);
    user.tokenVersion += 1;
    await user.save();
  }
}

function presentUser(u: UserDocument) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt ?? null,
  };
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
