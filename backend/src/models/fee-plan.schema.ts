import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { FEE_PLANS, type FeePlanCode } from '../common/fees.js';

/** Default fee per plan - pre-fills the fee amount when adding a student. */
@Schema({ timestamps: true })
export class FeePlan {
  @Prop({ required: true, unique: true, enum: FEE_PLANS })
  code: FeePlanCode;

  @Prop({ required: true })
  label: string;

  @Prop({ required: true })
  months: number;

  @Prop({ required: true, min: 0 })
  defaultAmount: number;
}

export type FeePlanDocument = HydratedDocument<FeePlan>;
export const FeePlanSchema = SchemaFactory.createForClass(FeePlan);
