import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { AdminOnly, CurrentUser, type AuthUser } from '../common/decorators.js';
import { ParseObjectIdPipe } from '../common/parse-object-id.pipe.js';
import { CreatePaymentDto, PaymentListQuery } from './payments.dto.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query() q: PaymentListQuery) {
    return this.payments.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseObjectIdPipe) id: string) {
    return this.payments.get(id);
  }

  @Post()
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthUser) {
    return this.payments.create(dto, user.id);
  }

  @AdminOnly()
  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.payments.remove(id);
  }
}
