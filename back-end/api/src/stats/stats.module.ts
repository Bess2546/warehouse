// src/stats/stats.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { Shipment, ShipmentSchema } from '../schemas/shipment.schema';
import { Tracker, TrackerSchema } from '../schemas/tracker.schema';
import { TagLastSeen, TagLastSeenSchema } from '../schemas/tag-last-seen.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shipment.name, schema: ShipmentSchema },
      { name: Tracker.name, schema: TrackerSchema },
      { name: TagLastSeen.name, schema: TagLastSeenSchema },
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}