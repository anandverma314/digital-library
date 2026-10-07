import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';

@Module({
  imports: [PaymentsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
