// src/timeline/timeline.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { TimelineService } from './timeline.service';

// DTO สำหรับ upsert (จะ validate ทีหลังก็ได้)
export class UpsertTimelineDto {
  tripId: string;          // TRIP2025-001
  stopSeq?: number;        // ลำดับจุด 1,2,3,...

  organizeId?: number;
  organizeName: string;    // BKK Hub, JB Border, ...

  eta?: string;            // ส่งมาเป็น ISO string หรือ '2025-12-03T14:00:00Z'
  ata?: string;
  etd?: string;
  atd?: string;
}

@Controller('timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  /**
   * GET /timeline/:tripId
   * ดึง timeline ของ trip นั้น ๆ
   * เช่น GET /timeline/TRIP2025-001
   */
  @Get(':tripId')
  async getTimelineByTrip(@Param('tripId') tripId: string) {
    const items = await this.timelineService.getTimelineByTrip(tripId);
    return {
      tripId,
      count: items.length,
      items,
    };
  }

  /**
   * POST /timeline/upsert
   * ใช้เพิ่ม/อัปเดตข้อมูล ETA/ATA/ETD/ATD ของแต่ละจุด
   *
   * ตัวอย่าง body:
   * {
   *   "tripId": "TRIP2025-001",
   *   "stopSeq": 1,
   *   "organizeName": "BKK Hub",
   *   "eta": "2025-12-03T14:00:00Z",
   *   "ata": "2025-12-03T14:18:00Z",
   *   "etd": "2025-12-03T17:00:00Z",
   *   "atd": "2025-12-03T17:00:00Z"
   * }
   */
  @Post('upsert')
  async upsertTimeline(@Body() body: UpsertTimelineDto) {
    await this.timelineService.upsertTimelineEvent({
      tripId: body.tripId,
      stopSeq: body.stopSeq,
      organizeId: body.organizeId,
      organizeName: body.organizeName,
      eta: body.eta,
      ata: body.ata,
      etd: body.etd,
      atd: body.atd,
    });

    return { success: true };
  }

  /**
   * (optional) ถ้าอยากให้ filter ตาม organize
   * GET /timeline/:tripId/by-organize?name=BKK%20Hub
   */
  @Get(':tripId/by-organize')
  async getTimelineByTripAndOrganize(
    @Param('tripId') tripId: string,
    @Query('name') organizeName?: string,
  ) {
    const items = await this.timelineService.getTimelineByTrip(tripId);
    const filtered = organizeName
      ? items.filter((x) => x.organizeName === organizeName)
      : items;

    return {
      tripId,
      organizeName: organizeName ?? null,
      count: filtered.length,
      items: filtered,
    };
  }
}
