// src/shipments/shipments.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { Shipment, ShipmentItem } from './entities';
import { TagMovementModule } from "../tag-movement/tag-movement.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Shipment, ShipmentItem]),
    forwardRef(() => TagMovementModule)
  ],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}