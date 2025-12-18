// src/stats/stats.controller.ts
import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getOverviewStats() {
    return this.statsService.getOverviewStats();
  }

  @Get('locations')
  getLocations() {
    return this.statsService.getLocations();
  }

  @Get('shipments/active')
  getActiveShipments() {
    return this.statsService.getActiveShipments();
  }

  @Get('tags/recent')
  getRecentTagDetections() {
    return this.statsService.getRecentTagDetections();
  }
}