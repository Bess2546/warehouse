// src/tag-movement/tag-scan-buffer.controller.ts
import { Controller, Get, Post, Delete, Query, Param, Body } from '@nestjs/common';
import { TagScanBufferService, MOVEMENT_CONFIG } from './tag-scan-buffer.service';

@Controller('tag-buffer')
export class TagScanBufferController {
  constructor(private readonly bufferService: TagScanBufferService) {}

  // GET /api/tag-buffer/config - ดู config ปัจจุบัน
  @Get('config')
  getConfig() {
    return {
      config: MOVEMENT_CONFIG,
      description: {
        RSSI_THRESHOLD: 'สัญญาณต้องแรงกว่านี้ถึงจะนับ (dBm)',
        IN_COUNT_THRESHOLD: 'ต้องเห็นกี่ครั้งถึงจะนับว่า IN',
        IN_TIME_WINDOW_SEC: 'ภายในกี่วินาที',
        OUT_COUNT_THRESHOLD: 'ไม่เห็นกี่ครั้งติดต่อกันถึงจะนับว่า OUT',
        OUT_TIMEOUT_SEC: 'หรือไม่เห็นนานกี่วินาที',
      },
    };
  }

  // GET /api/tag-buffer/warehouse/:warehouseId?orgId=1 - ดู buffer ของ warehouse
  @Get('warehouse/:warehouseId')
  async getByWarehouse(
    @Param('warehouseId') warehouseId: string,
    @Query('orgId') orgId: string,
  ) {
    const buffers = await this.bufferService.getBufferByWarehouse(
      Number(orgId) || 0,
      warehouseId,
    );

    const summary = await this.bufferService.getWarehouseBufferSummary(
      Number(orgId) || 0,
      warehouseId,
    );

    return {
      warehouseId,
      summary,
      count: buffers.length,
      buffers,
    };
  }

  // GET /api/tag-buffer/warehouse/:warehouseId/summary?orgId=1 - สรุปสถานะ
  @Get('warehouse/:warehouseId/summary')
  async getWarehouseSummary(
    @Param('warehouseId') warehouseId: string,
    @Query('orgId') orgId: string,
  ) {
    const summary = await this.bufferService.getWarehouseBufferSummary(
      Number(orgId) || 0,
      warehouseId,
    );

    return {
      warehouseId,
      ...summary,
    };
  }

  // GET /api/tag-buffer/warehouse/:warehouseId/in?orgId=1 - tags ที่ CONFIRMED_IN
  @Get('warehouse/:warehouseId/in')
  async getConfirmedInTags(
    @Param('warehouseId') warehouseId: string,
    @Query('orgId') orgId: string,
  ) {
    const tags = await this.bufferService.getConfirmedInTags(
      Number(orgId) || 0,
      warehouseId,
    );

    return {
      warehouseId,
      status: 'CONFIRMED_IN',
      count: tags.length,
      tags,
    };
  }

  // GET /api/tag-buffer/warehouse/:warehouseId/pending-out?orgId=1 - tags ที่กำลังจะ OUT
  @Get('warehouse/:warehouseId/pending-out')
  async getPendingOutTags(
    @Param('warehouseId') warehouseId: string,
    @Query('orgId') orgId: string,
  ) {
    const tags = await this.bufferService.getPendingOutTags(
      Number(orgId) || 0,
      warehouseId,
    );

    return {
      warehouseId,
      status: 'PENDING_OUT',
      count: tags.length,
      tags,
    };
  }

  // GET /api/tag-buffer/tag/:tagUid?orgId=1 - ดู buffer ของ tag
  @Get('tag/:tagUid')
  async getByTag(
    @Param('tagUid') tagUid: string,
    @Query('orgId') orgId: string,
  ) {
    const buffers = await this.bufferService.getBufferByTag(
      Number(orgId) || 0,
      tagUid,
    );

    return {
      tagUid,
      count: buffers.length,
      buffers,
    };
  }

  // DELETE /api/tag-buffer/tag/:tagUid/:warehouseId?orgId=1 - reset buffer
  @Delete('tag/:tagUid/:warehouseId')
  async resetBuffer(
    @Param('tagUid') tagUid: string,
    @Param('warehouseId') warehouseId: string,
    @Query('orgId') orgId: string,
  ) {
    const result = await this.bufferService.resetTagBuffer(
      Number(orgId) || 0,
      tagUid,
      warehouseId,
    );

    return {
      success: result,
      message: result ? 'Buffer reset successfully' : 'Buffer not found',
    };
  }
}