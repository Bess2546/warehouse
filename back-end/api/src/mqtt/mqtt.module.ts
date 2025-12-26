// src/mqtt/mqtt.module.ts
import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { TagModule } from '../tag/tag.module';
import { TagMovementModule } from '../tag-movement/tag-movement.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { TrackerModule } from "../Tracker/tracker.module";

@Module({
  imports: [
    TagModule,
    TagMovementModule,
    WarehouseModule,
    TrackerModule,
  ],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}