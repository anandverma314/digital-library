import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DEFAULT_LIBRARY_NAME, DEFAULT_RECEIPT_PREFIX } from '../common/constants.js';

/** Single document holding library-wide settings. */
@Schema({ timestamps: true })
export class Setting {
  @Prop({ default: DEFAULT_LIBRARY_NAME })
  libraryName: string;

  @Prop({ default: '' })
  contactPhone: string;

  @Prop({ default: '' })
  contactEmail: string;

  @Prop({ default: '' })
  address: string;

  @Prop({ default: DEFAULT_RECEIPT_PREFIX })
  receiptPrefix: string;

  /** A fee becomes "Due" this many days before its due date. */
  @Prop({ default: 5, min: 0, max: 60 })
  dueReminderDays: number;
}

export type SettingDocument = HydratedDocument<Setting>;
export const SettingSchema = SchemaFactory.createForClass(Setting);
