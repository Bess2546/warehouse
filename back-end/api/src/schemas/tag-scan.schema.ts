// src/schemas/tag-scan.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'TagScanProcessed', timestamps: false })
export class TagScan extends Document {
  @Prop()
  OrgId: number;

  @Prop()
  SourceType: string; // "M5"

  @Prop()
  SourceId: string;

  @Prop()
  EventTime: Date;

  @Prop()
  Lat: number;

  @Prop()
  Lng: number;

  @Prop({ type: [Object] })
  Tags: Array<{
    TagUid: string;
    Rssi: number;
    BatteryVoltageMv: number;
    raw: string;
  }>;

  @Prop()
  HasValidLocation: boolean;

  @Prop()
  Note: string;
}

export const TagScanSchema = SchemaFactory.createForClass(TagScan);