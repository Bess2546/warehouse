// src/tms/tms.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TmsService } from './tms.service';
import { TmsController } from './tms.controller';
import { Shipment, ShipmentSchema } from '../schemas/shipment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {name: Shipment.name, schema: ShipmentSchema},
    ]),
  ],
  controllers: [TmsController],
  providers: [TmsService],
  exports: [TmsService],  
})
export class TmsModule {}
