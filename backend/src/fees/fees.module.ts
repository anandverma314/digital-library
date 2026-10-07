import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { StudentsService } from '../students/students.service.js';
import { FeesController } from './fees.controller.js';

@Module({
  imports: [PaymentsModule],
  controllers: [FeesController],
  providers: [StudentsService],
})
export class FeesModule {}
