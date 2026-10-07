import { Module } from '@nestjs/common';
import { DashboardController } from '../dashboard/dashboard.controller.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { ReportsController } from './reports.controller.js';

@Module({
  imports: [PaymentsModule],
  controllers: [DashboardController, ReportsController],
})
export class ReportsModule {}
