// src/schemas/tag-last-seen.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'TagLastSeenProcessed', timestamps: false })
export class TagLastSeen extends Document {
  @Prop()
  TagUid: string;

  @Prop()
  OrgId: number;

  @Prop()
  BatteryVoltageMv: number;

  @Prop()
  EventTime: Date;

  @Prop()
  LastRssi: number;

  @Prop()
  Lat: number;

  @Prop()
  Lng: number;

  @Prop()
  Note: string;

  @Prop()
  SourceId: string;

  @Prop()
  SourceType: string; // "M5"
}

export const TagLastSeenSchema = SchemaFactory.createForClass(TagLastSeen);