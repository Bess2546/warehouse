// src/warehouses/warehouses.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { WarehouseService } from '../warehouse/warehouse.service';

class CreateWarehouseDto {
  name: string;
  code: string;
  type: 'ORIGIN' | 'DESTINATION' | 'HUB';
  organizationId: number;
  trackerId?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  phone?: string;
}

class AssignTrackerDto {
  trackerId: number;
}

@Controller('warehouses')
export class WarehouseController {
  constructor(private readonly warehousesService: WarehouseService) {}

  // GET /api/warehouses?orgId=10 - ดึง warehouses ทั้งหมด
  @Get()
  async findAll(@Query('orgId') orgId?: string) {
    const warehouses = await this.warehousesService.findAll(
      orgId ? Number(orgId) : undefined,
    );
    return {
      count: warehouses.length,
      warehouses,
    };
  }

  // GET /api/warehouses/m5/:imei - หา warehouse จาก M5 IMEI
  @Get('m5/:imei')
  async getByM5(@Param('imei') imei: string) {
    const warehouse = await this.warehousesService.getWarehouseByM5(imei);
    if (!warehouse) {
      return { success: false, message: 'No warehouse found for this M5' };
    }
    return { success: true, data: warehouse };
  }

  // GET /api/warehouses/code/:code - หา warehouse จาก code
  @Get('code/:code')
  async getByCode(@Param('code') code: string) {
    const warehouse = await this.warehousesService.findByCode(code);
    if (!warehouse) {
      return { success: false, message: 'Warehouse not found' };
    }
    return { success: true, data: warehouse };
  }

  // GET /api/warehouses/:id - ดึง warehouse by ID
  @Get(':id')
  async findById(@Param('id') id: string) {
    const warehouse = await this.warehousesService.findById(Number(id));
    if (!warehouse) {
      return { success: false, message: 'Warehouse not found' };
    }
    return { success: true, data: warehouse };
  }

  // POST /api/warehouses - สร้าง warehouse ใหม่
  @Post()
  async create(@Body() dto: CreateWarehouseDto) {
    try {
      const warehouse = await this.warehousesService.create(dto);
      return {
        success: true,
        message: 'Warehouse created successfully',
        data: warehouse,
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // PUT /api/warehouses/:id - update warehouse
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<CreateWarehouseDto>) {
    try {
      const warehouse = await this.warehousesService.update(Number(id), dto);
      return {
        success: true,
        message: 'Warehouse updated successfully',
        data: warehouse,
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // PUT /api/warehouses/:id/assign-tracker - assign tracker ให้ warehouse
  @Put(':id/assign-tracker')
  async assignTracker(
    @Param('id') id: string,
    @Body() dto: AssignTrackerDto,
  ) {
    try {
      const warehouse = await this.warehousesService.assignTracker(
        Number(id),
        dto.trackerId,
      );
      return {
        success: true,
        message: 'Tracker assigned successfully',
        data: warehouse,
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // DELETE /api/warehouses/:id - ลบ warehouse
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.warehousesService.delete(Number(id));
    return { success: true, message: 'Warehouse deleted' };
  }
}