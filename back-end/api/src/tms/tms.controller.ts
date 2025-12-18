// src/tms/tms.controller.ts
import { Controller, Get, Post, Put, Param, Body, Query } from "@nestjs/common";
import { TmsService } from "./tms.service";

@Controller('tms')
export class TmsController {
  constructor(private readonly tmsService: TmsService) {}

  @Get('shipments')
  findAllShipments(@Query('status') status?: string) {
    return this.tmsService.findAllShipments(status);
  }

  @Get('shipments/:id')
  findShipmentById(@Param('id') id: string) {
    return this.tmsService.findShipmentById(id);
  }

  @Post('shipments')
  createShipment(@Body() data: any) {
    return this.tmsService.createShipment(data);
  }

  @Put('shipments/:id')
  updateShipment(@Param('id') id: string, @Body() data: any) {
    return this.tmsService.updateShipment(id, data);
  }

  @Get('shipments/:id/timeline')
  getShipmentTimeline(@Param('id') id: string) {
    return this.tmsService.getShipmentTimeline(id);
  }
}