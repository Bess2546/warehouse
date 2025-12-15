// src/stats/stats.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class StatsService {
  constructor(
    @InjectModel('Shipment') private shipmentModel: Model<any>,
    @InjectModel('Tracker') private trackerModel: Model<any>,
    @InjectModel('Tag') private tagModel: Model<any>,
    // เพิ่ม model อื่นๆ ตามที่มี
  ) {}

  async getOverviewStats() {
    // นับจำนวนต่างๆ
    const [
      activeShipments,
      delayedShipments,
      activeTrackers,
      tagsDetected,
      locations
    ] = await Promise.all([
      this.shipmentModel.countDocuments({ status: 'active' }),
      this.shipmentModel.countDocuments({ status: 'delayed' }),
      this.trackerModel.countDocuments({ status: 'active' }),
      this.tagModel.countDocuments(),
      this.getLocations(),
    ]);

    return {
      activeShipments,
      delayed: delayedShipments,
      activeTrackers,
      tagsDetected,
      locations,
    };
  }

  async getLocations() {
    // ดึง location ทั้งหมด (ปรับตาม schema ของคุณ)
    const trackers = await this.trackerModel.find({ status: 'active' });
    return trackers.map(t => ({
      id: t._id,
      name: t.name || t.deviceId,
      latitude: t.location?.latitude,
      longitude: t.location?.longitude,
    }));
  }

  async getActiveShipments() {
    return this.shipmentModel.find({ status: 'active' }).limit(10);
  }

  async getRecentTagDetections() {
    return this.tagModel
      .find()
      .sort({ lastSeen: -1 })
      .limit(10);
  }
}