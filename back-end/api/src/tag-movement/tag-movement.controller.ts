// src/tag-movement/tag-movement.controller.ts

import { Controller, Get, Post, Body, Param, Query} from "@nestjs/common";
import { TagMovementService, TagMovement } from "../tag-movement/tag-movement.service";

// DTO สำหรับ record movement
class RecordMovementDto {
  OrgId: number;
  TagUid: string;
  Action: 'IN' | 'OUT';
  WarehouseId: string;
  WarehouseName: string;
  SourceId: string;
  SourceType?: string;
  ShipmentId?: string;
  Note?: string;
}

@Controller('tag-movement')
export class TagMovementController {
  constructor(private readonly movementService: TagMovementService) {}

  // ==================== CREATE ====================

  // POST /api/tag-movement/record - บันทึก movement ใหม่
  @Post('record')
  async recordMovement(@Body() dto: RecordMovementDto) {
    const movement = await this.movementService.recordMovement({
      OrgId: dto.OrgId,
      TagUid: dto.TagUid,
      Action: dto.Action,
      Timestamp: new Date(),
      WarehouseId: dto.WarehouseId,
      WarehouseName: dto.WarehouseName,
      SourceId: dto.SourceId,
      SourceType: dto.SourceType || 'M5',
      ShipmentId: dto.ShipmentId,
      Note: dto.Note,
    });

    return {
      success: true,
      message: `Recorded ${dto.Action} for tag ${dto.TagUid}`,
      data: movement,
    };
  }

  // POST /api/tag-movement/in - บันทึก IN
  @Post('in')
  async recordIN(@Body() dto: RecordMovementDto) {
    const movement = await this.movementService.recordIN(
      dto.OrgId,
      dto.TagUid,
      dto.WarehouseId,
      dto.WarehouseName,
      dto.SourceId,
      dto.SourceType,
      dto.ShipmentId,
    );

    return {
      success: true,
      message: `Tag ${dto.TagUid} checked IN at ${dto.WarehouseName}`,
      data: movement,
    };
  }

  // POST /api/tag-movement/out - บันทึก OUT
  @Post('out')
  async recordOUT(@Body() dto: RecordMovementDto) {
    const movement = await this.movementService.recordOUT(
      dto.OrgId,
      dto.TagUid,
      dto.WarehouseId,
      dto.WarehouseName,
      dto.SourceId,
      dto.SourceType,
      dto.ShipmentId,
    );

    return {
      success: true,
      message: `Tag ${dto.TagUid} checked OUT from ${dto.WarehouseName}`,
      data: movement,
    };
  }

  // ==================== READ ====================

  // GET /api/tag-movement/recent?orgId=1&limit=50 - ดึง movement ล่าสุด
  @Get('recent')
  async getRecentMovements(
    @Query('orgId') orgId: string,
    @Query('limit') limit?: string,
  ) {
    const movements = await this.movementService.getRecentMovements(
      Number(orgId) || 0,
      limit ? Number(limit) : 50,
    );

    return {
      count: movements.length,
      movements,
    };
  }

  // GET /api/tag-movement/tag/:tagUid?orgId=1 - ดึงประวัติของ tag
  @Get('tag/:tagUid')
  async getMovementsByTag(
    @Param('tagUid') tagUid: string,
    @Query('orgId') orgId: string,
    @Query('limit') limit?: string,
  ) {
    const movements = await this.movementService.getMovementsByTag(
      Number(orgId) || 0,
      tagUid,
      limit ? Number(limit) : 50,
    );

    const summary = await this.movementService.getTagSummary(
      Number(orgId) || 0,
      tagUid,
    );

    return {
      tagUid,
      summary,
      count: movements.length,
      movements,
    };
  }

  // GET /api/tag-movement/tag/:tagUid/last?orgId=1 - ดึง movement ล่าสุดของ tag
  @Get('tag/:tagUid/last')
  async getLastMovement(
    @Param('tagUid') tagUid: string,
    @Query('orgId') orgId: string,
  ) {
    const lastMovement = await this.movementService.getLastMovement(
      Number(orgId) || 0,
      tagUid,
    );

    return {
      tagUid,
      lastMovement,
      currentLocation: lastMovement?.Action === 'IN' ? lastMovement.WarehouseName : 'In Transit / Unknown',
    };
  }

  // GET /api/tag-movement/warehouse/:warehouseId?orgId=1 - ดึงประวัติของ warehouse
  @Get('warehouse/:warehouseId')
  async getMovementsByWarehouse(
    @Param('warehouseId') warehouseId: string,
    @Query('orgId') orgId: string,
    @Query('limit') limit?: string,
  ) {
    const movements = await this.movementService.getMovementsByWarehouse(
      Number(orgId) || 0,
      warehouseId,
      limit ? Number(limit) : 50,
    );

    const summary = await this.movementService.getWarehouseSummary(
      Number(orgId) || 0,
      warehouseId,
    );

    return {
      warehouseId,
      summary,
      count: movements.length,
      movements,
    };
  }

  // GET /api/tag-movement/warehouse/:warehouseId/tags?orgId=1 - ดึง tags ที่อยู่ใน warehouse
  @Get('warehouse/:warehouseId/tags')
  async getTagsInWarehouse(
    @Param('warehouseId') warehouseId: string,
    @Query('orgId') orgId: string,
  ) {
    const tags = await this.movementService.getTagsInWarehouse(
      Number(orgId) || 0,
      warehouseId,
    );

    return {
      warehouseId,
      count: tags.length,
      tags,
    };
  }

  // ==================== SUMMARY ====================

  // GET /api/tag-movement/summary?orgId=1 - สรุปข้อมูลทั้งระบบ
  @Get('summary')
  async getOverallSummary(@Query('orgId') orgId: string) {
    const summary = await this.movementService.getOverallSummary(
      Number(orgId) || 0,
    );

    return summary;
  }

  // ==================== FILTER BY DATE ====================

  // GET /api/tag-movement/range?orgId=1&start=2025-01-01&end=2025-01-31
  @Get('range')
  async getMovementsByDateRange(
    @Query('orgId') orgId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const movements = await this.movementService.getMovementsByDateRange(
      Number(orgId) || 0,
      startDate,
      endDate,
      warehouseId,
    );

    return {
      startDate,
      endDate,
      warehouseId: warehouseId || 'all',
      count: movements.length,
      movements,
    };
  }
}