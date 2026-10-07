import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { FeesModule } from './fees/fees.module.js';
import { ModelsModule } from './models/index.js';
import { PaymentsModule } from './payments/payments.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { StudentsModule } from './students/students.module.js';

/** Makes every Mongoose model injectable everywhere. */
@Global()
@Module({ imports: [ModelsModule], exports: [ModelsModule] })
class DatabaseModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: () => ({ uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/digital_library' }),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    DatabaseModule,
    SettingsModule,
    AuthModule,
    StudentsModule,
    PaymentsModule,
    FeesModule,
    ReportsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
