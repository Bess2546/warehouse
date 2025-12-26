// src/tracker/tracker.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from "@nestjs/typeorm";
import { TrackerService } from './tracker.service';
import { TrackerController } from './tracker.controller';
import { TrackerEntity } from './entities/tracker.entity';
import { Organization } from '../organizations/entities/organization.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackerEntity, Organization]),
  ],
  controllers: [TrackerController],
  providers: [TrackerService],
  exports: [TrackerService],
})
export class TrackerModule {}