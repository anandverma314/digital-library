import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Atomic sequence numbers (e.g. receipt numbers). */
@Schema()
export class Counter {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ default: 0 })
  value: number;
}

export type CounterDocument = HydratedDocument<Counter>;
export const CounterSchema = SchemaFactory.createForClass(Counter);
