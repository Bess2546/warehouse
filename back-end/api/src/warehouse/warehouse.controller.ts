// src/warehouse/warehouse.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { WarehouseService, Warehouse } from './warehouse.service';

class CreateWarehouseDto {
  OrgId: number;
  Name: string;
  Code: string;
  M5DeviceId: string;
  Type: 'ORIGIN' | 'DESTINATION' | 'HUB';
  Location?: {
    Lat: number;
    Lng: number;
    Address: string;
  };
}

class UpdateWarehouseDto {
  Name?: string;
  Code?: string;
  M5DeviceId?: string;
  Type?: 'ORIGIN' | 'DESTINATION' | 'HUB';
  Location?: {
    Lat: number;
    Lng: number;
    Address: string;
  };
  IsActive?: boolean;
}

@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  // POST /api/warehouse - สร้าง warehouse ใหม่
  @Post()
  async create(@Body() dto: CreateWarehouseDto) {
    const warehouse = await this.warehouseService.createWarehouse({
      OrgId: dto.OrgId,
      Name: dto.Name,
      Code: dto.Code,
      M5DeviceId: dto.M5DeviceId,
      Type: dto.Type,
      Location: dto.Location,
      IsActive: true,
    });

    return {
      success: true,
      message: `Created warehouse: ${dto.Name}`,
      data: warehouse,
    };
  }

  // GET /api/warehouse?orgId=1 - ดึง warehouse ทั้งหมด
  @Get()
  async getAll(@Query('orgId') orgId: string) {
    const warehouses = await this.warehouseService.getWarehouses(Number(orgId) || 0);
    return {
      count: warehouses.length,
      warehouses,
    };
  }

  // GET /api/warehouse/:id - ดึง warehouse by ID
  @Get(':id')
  async getById(@Param('id') id: string) {
    const warehouse = await this.warehouseService.getWarehouseById(id);
    if (!warehouse) {
      return { success: false, message: 'Warehouse not found' };
    }
    return { success: true, data: warehouse };
  }

  // GET /api/warehouse/m5/:deviceId - ดึง warehouse by M5 Device ID
  @Get('m5/:deviceId')
  async getByM5(@Param('deviceId') deviceId: string) {
    const warehouse = await this.warehouseService.getWarehouseByM5(deviceId);
    if (!warehouse) {
      return { success: false, message: 'No warehouse found for this M5 device' };
    }
    return { success: true, data: warehouse };
  }

  // PUT /api/warehouse/:id - อัปเดต warehouse
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    const warehouse = await this.warehouseService.updateWarehouse(id, dto);
    if (!warehouse) {
      return { success: false, message: 'Warehouse not found' };
    }
    return {
      success: true,
      message: 'Warehouse updated',
      data: warehouse,
    };
  }

  // DELETE /api/warehouse/:id - ลบ warehouse
  @Delete(':id')
  async delete(@Param('id') id: string) {
    const result = await this.warehouseService.deleteWarehouse(id);
    return {
      success: result,
      message: result ? 'Warehouse deleted' : 'Warehouse not found',
    };
  }
}