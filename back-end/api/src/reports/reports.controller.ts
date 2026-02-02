import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * GET /reports/summary
   * ภาพรวมทั้งหมด: totalTags, totalIn, totalOut, totalWarehouses, etc.
   */
  @Get('summary')
  async getSummary(@Request() req) {
    const orgId = req.user.organizationId;
    return this.reportsService.getSummary(orgId);
  }

  /**
   * GET /reports/daily-movements?days=7
   * Daily IN/OUT movements for chart
   */
  @Get('daily-movements')
  async getDailyMovements(
    @Request() req,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    const orgId = req.user.organizationId;
    // Limit to max 90 days
    const limitedDays = Math.min(days, 90);
    return this.reportsService.getDailyMovements(orgId, limitedDays);
  }

  /**
   * GET /reports/warehouse-stats
   * Tags count per warehouse
   */
  @Get('warehouse-stats')
  async getWarehouseStats(@Request() req) {
    const orgId = req.user.organizationId;
    return this.reportsService.getWarehouseStats(orgId);
  }

  /**
   * GET /reports/shipment-stats
   * Shipment status breakdown
   */
  @Get('shipment-stats')
  async getShipmentStats(@Request() req) {
    const orgId = req.user.organizationId;
    return this.reportsService.getShipmentStats(orgId);
  }

  /**
   * GET /reports/hourly-activity?date=2025-01-16
   * Hourly IN/OUT for a specific day
   */
  @Get('hourly-activity')
  async getHourlyActivity(
    @Request() req,
    @Query('date') dateStr?: string,
  ) {
    const orgId = req.user.organizationId;
    const date = dateStr ? new Date(dateStr) : new Date();
    return this.reportsService.getHourlyActivity(orgId, date);
  }

  /**
   * GET /reports/top-tags?limit=10
   * Most active tags
   */
  @Get('top-tags')
  async getTopActiveTags(
    @Request() req,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const orgId = req.user.organizationId;
    // Limit to max 50
    const limitedCount = Math.min(limit, 50);
    return this.reportsService.getTopActiveTags(orgId, limitedCount);
  }
}