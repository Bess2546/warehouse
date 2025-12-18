// src/schemas/shipment.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'shipments', timestamps: true })
export class Shipment extends Document {
  @Prop()
  id: number;

  @Prop()
  tripId: string;

  @Prop()
  referenceNo: string;

  @Prop()
  description: string;

  @Prop()
  type: string;

  @Prop()
  serviceType: string;

  @Prop({ type: Object })
  origin: {
    organizeId: number;
    organizeName: string;
  };

  @Prop({ type: Object })
  destination: {
    organizeId: number;
    organizeName: string;
  };

  @Prop({ type: [Object] })
  route: Array<{
    seq: number;
    organizeId: number;
    organizeName: string;
    type: string;
    plannedArrival?: Date;
    plannedDeparture?: Date;
    actualArrival?: Date;
    actualDeparture?: Date;
    arrivalDelayMin?: number;
    departureDelayMin?: number;
  }>;

  @Prop()
  vehicleId: number;

  @Prop()
  vehiclePlate: string;

  @Prop()
  driverId: number;

  @Prop()
  driverName: string;

  @Prop()
  trackerId: number;

  @Prop({ type: Object })
  cargo: {
    description: string;
    weight: number;
    volume: number;
    packages: number;
    value: number;
    currency: string;
  };

  @Prop()
  status: string;

  @Prop()
  currentStopSeq: number;

  @Prop()
  currentOrganizeId: number;

  @Prop()
  totalDelayMin: number;

  @Prop()
  onTimeStatus: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ShipmentSchema = SchemaFactory.createForClass(Shipment);