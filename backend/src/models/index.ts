import { MongooseModule } from '@nestjs/mongoose';
import { Counter, CounterSchema } from './counter.schema.js';
import { FeePlan, FeePlanSchema } from './fee-plan.schema.js';
import { Payment, PaymentSchema } from './payment.schema.js';
import { Seat, SeatSchema } from './seat.schema.js';
import { Setting, SettingSchema } from './setting.schema.js';
import { Student, StudentSchema } from './student.schema.js';
import { Timing, TimingSchema } from './timing.schema.js';
import { User, UserSchema } from './user.schema.js';

/** Registers every model once; imported by the global DatabaseModule. */
export const ModelsModule = MongooseModule.forFeature([
  { name: User.name, schema: UserSchema },
  { name: Student.name, schema: StudentSchema },
  { name: Payment.name, schema: PaymentSchema },
  { name: FeePlan.name, schema: FeePlanSchema },
  { name: Seat.name, schema: SeatSchema },
  { name: Timing.name, schema: TimingSchema },
  { name: Setting.name, schema: SettingSchema },
  { name: Counter.name, schema: CounterSchema },
]);
