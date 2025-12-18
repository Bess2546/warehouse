// src/stats/stats.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Shipment } from '../schemas/shipment.schema';
import { Tracker } from '../schemas/tracker.schema';
import { TagLastSeen } from '../schemas/tag-last-seen.schema';

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(Shipment.name) private shipmentModel: Model<Shipment>,
    @InjectModel(Tracker.name) private trackerModel: Model<Tracker>,
    @InjectModel(TagLastSeen.name) private tagModel: Model<TagLastSeen>,
  ) {}

  async getOverviewStats() {
    const [
      activeShipments,
      delayedShipments,
      activeTrackers,
      tagsDetected,
      locations,
    ] = await Promise.all([
      this.shipmentModel.countDocuments({
        status: 'IN_TRANSIT',
        isActive: true,
      }),
      this.shipmentModel.countDocuments({
        onTimeStatus: 'DELAYED',
        isActive: true,
      }),
      // แก้เป็นตัวพิมพ์ใหญ่
      this.trackerModel.countDocuments({ 
        status: 'ACTIVE',
        isActive: true 
      }),
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
    const activeShipments = await this.shipmentModel
      .find({
        status: 'IN_TRANSIT',
        isActive: true,
      })
      .limit(50)
      .exec();

    return activeShipments.map((shipment) => {
      const currentStop = shipment.route.find(
        (r) => r.seq === shipment.currentStopSeq,
      );
      return {
        id: shipment._id.toString(),
        name: `${shipment.tripId} - ${shipment.vehiclePlate}`,
        type: 'shipment',
        organizeName: currentStop?.organizeName || 'Unknown',
        status: shipment.onTimeStatus,
      };
    });
  }

  async getActiveShipments() {
    return this.shipmentModel
      .find({
        status: 'IN_TRANSIT',
        isActive: true,
      })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select(
        'tripId referenceNo origin destination status onTimeStatus vehiclePlate driverName currentStopSeq totalDelayMin route',
      )
      .exec();
  }

  async getRecentTagDetections() {
    return this.tagModel
      .find()
      .sort({ EventTime: -1 }) 
      .limit(10)
      .select('TagUid SourceId LastRssi BatteryVoltageMv EventTime OrgId')
      .exec();
  }
}