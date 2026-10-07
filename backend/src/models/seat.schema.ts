import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Optional list of the library's seats, used to suggest free seats. */
@Schema({ timestamps: true })
export class Seat {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  number: string;

  @Prop({ default: true })
  isActive: boolean;
}

export type SeatDocument = HydratedDocument<Seat>;
export const SeatSchema = SchemaFactory.createForClass(Seat);
