// src/trackers/trackers.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { TrackerService } from './tracker.service';

class CreateTrackerDto {
  imei: string;
  serialNumber?: string;
  brand?: string;
  model?: string;
  description?: string;
  version?: string;
}

class AssignOrgDto {
  organizationId: number;
}

class UpdateStatusDto {
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'STOCKED';
}

@Controller('trackers')
export class TrackerController {
  constructor(private readonly trackerService: TrackerService) {}

  // GET /api/trackers - ดึง trackers ทั้งหมด
  @Get()
  async findAll() {
    const trackers = await this.trackerService.findAll();
    return {
      count: trackers.length,
      trackers,
    };
  }

  // GET /api/trackers/imei/:imei - ดึง tracker by IMEI
  @Get('imei/:imei')
  async findByImei(@Param('imei') imei: string) {
    const tracker = await this.trackerService.findByImei(imei);
    if (!tracker) {
      return { success: false, message: 'Tracker not found' };
    }
    return { success: true, data: tracker };
  }

  // GET /api/trackers/organize/:imei - ดึง organization ของ M5
  @Get('organize/:imei')
  async getOrganize(@Param('imei') imei: string) {
    const org = await this.trackerService.getOrganizeByM5(imei);
    if (!org) {
      return { success: false, message: 'Organization not found for this IMEI' };
    }
    return { success: true, data: org };
  }

  // GET /api/trackers/:id - ดึง tracker by ID
  @Get(':id')
  async findById(@Param('id') id: string) {
    const tracker = await this.trackerService.findById(Number(id));
    if (!tracker) {
      return { success: false, message: 'Tracker not found' };
    }
    return { success: true, data: tracker };
  }

  // POST /api/trackers - สร้าง tracker ใหม่
  @Post()
  async create(@Body() dto: CreateTrackerDto) {
    try {
      const tracker = await this.trackerService.create(dto);
      return {
        success: true,
        message: 'Tracker created successfully',
        data: tracker,
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // PUT /api/trackers/:imei/assign - assign tracker ให้ organization
  @Put(':imei/assign')
  async assignToOrg(
    @Param('imei') imei: string,
    @Body() dto: AssignOrgDto,
  ) {
    try {
      const tracker = await this.trackerService.assignToOrganization(imei, dto.organizationId);
      return {
        success: true,
        message: 'Tracker assigned successfully',
        data: tracker,
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // PUT /api/trackers/:imei/status - update status
  @Put(':imei/status')
  async updateStatus(
    @Param('imei') imei: string,
    @Body() dto: UpdateStatusDto,
  ) {
    try {
      const tracker = await this.trackerService.updateStatus(imei, dto.status);
      return {
        success: true,
        message: 'Status updated successfully',
        data: tracker,
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  // DELETE /api/trackers/:id - ลบ tracker
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.trackerService.delete(Number(id));
    return { success: true, message: 'Tracker deleted' };
  }
}