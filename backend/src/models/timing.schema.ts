import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Timing {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  /** Optional display times, e.g. "06:00" - "12:00" */
  @Prop()
  startTime?: string;

  @Prop()
  endTime?: string;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ default: true })
  isActive: boolean;
}

export type TimingDocument = HydratedDocument<Timing>;
export const TimingSchema = SchemaFactory.createForClass(Timing);
