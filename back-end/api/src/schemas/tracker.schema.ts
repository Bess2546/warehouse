// src/schemas/tracker.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'trackers', timestamps: true })
export class Tracker extends Document {
  @Prop()
  id: number;

  @Prop()
  imei: string;

  @Prop()
  serialNumber: string;

  @Prop()
  simNumber: string;

  @Prop()
  deviceModel: string;

  @Prop()
  firmwareVersion: string;

  @Prop()
  organizeId: number;

  @Prop()
  organizeName: string;

  @Prop()
  vehicleId?: number;

  @Prop()
  status: string;

  @Prop()
  lastSeen: Date;

  @Prop()
  lastBattery: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const TrackerSchema = SchemaFactory.createForClass(Tracker);