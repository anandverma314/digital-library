import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { AdminOnly, CurrentUser, type AuthUser } from '../common/decorators.js';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe.js';
import { CreateUserDto, SetPasswordDto, UpdateUserDto } from './users.dto.js';
import { UsersService } from './users.service.js';

@AdminOnly()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.update(id, dto, actor.id);
  }

  @Post(':id/password')
  @HttpCode(200)
  async setPassword(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: SetPasswordDto) {
    await this.users.setPassword(id, dto.password);
    return { message: 'Password updated. The user has been signed out everywhere.' };
  }
}
