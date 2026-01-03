// src/shipments/shipments.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto, UpdateShipmentDto, ShipmentQueryDto } from './dto/shipment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';

@Controller('shipments')
@UseGuards(JwtAuthGuard)
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  // สร้าง Shipment ใหม่
  @Post()
  async create(
    @Body() dto: CreateShipmentDto,
    @CurrentUser('userId') userId: number,
  ) {
    return this.shipmentsService.create(dto, userId);
  }

  // ดึง Shipments ทั้งหมด
  @Get()
  async findAll(@Query() query: ShipmentQueryDto) {
    return this.shipmentsService.findAll(query);
  }

  // ดึงสถิติ Shipments
  @Get('stats')
  async getStats(@Query('orgId') orgId?: number) {
    return this.shipmentsService.getStats(orgId);
  }

  // ดึง Shipment ตาม Code
  @Get('code/:code')
  async findByCode(@Param('code') code: string) {
    return this.shipmentsService.findByCode(code);
  }

  // ดึง Shipments ที่มี Tag นี้
  @Get('tag/:tagUid')
  async findByTag(@Param('tagUid') tagUid: string) {
    return this.shipmentsService.findByTagUid(tagUid);
  }

  // ดึง Shipment ตาม ID
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.shipmentsService.findOne(id);
  }

  // อัพเดท Shipment
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShipmentDto,
  ) {
    return this.shipmentsService.update(id, dto);
  }

  // ยกเลิก Shipment
  @Patch(':id/cancel')
  async cancel(@Param('id', ParseIntPipe) id: number) {
    return this.shipmentsService.cancel(id);
  }

  // ลบ Shipment
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.shipmentsService.remove(id);
    return { message: 'ลบ Shipment สำเร็จ' };
  }
}