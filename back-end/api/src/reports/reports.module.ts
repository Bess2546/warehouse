import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { WarehouseEntity } from '../warehouse/warehouse.entity';
import { ShipmentItem } from '../shipments/entities/shipment-item.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { TagMovementModule } from '../tag-movement/tag-movement.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WarehouseEntity, Shipment, ShipmentItem]),
    TagMovementModule,
    CommonModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}