import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Db } from 'mongodb';
import { WarehouseEntity } from '../warehouse/warehouse.entity';
import { Shipment, ShipmentStatus } from '../shipments/entities/shipment.entity';
import { ShipmentItem } from '../shipments/entities/shipment-item.entity';
import { MongoService } from '../common/mongo.service';

export interface SummaryResponse {
  totalTags: number;
  totalIn: number;
  totalOut: number;
  totalWarehouses: number;
  totalShipments: number;
  todayIn: number;
  todayOut: number;
}

export interface DailyMovement {
  date: string;
  IN: number;
  OUT: number;
}

export interface WarehouseStats {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  tagCount: number;
  todayIn: number;
  todayOut: number;
}

export interface ShipmentStats {
  pending: number;
  inTransit: number;
  delivered: number;
  total: number;
}

export interface HourlyActivity {
  hour: number;
  IN: number;
  OUT: number;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(WarehouseEntity)
    private warehouseRepo: Repository<WarehouseEntity>,
    @InjectRepository(Shipment)
    private shipmentRepo: Repository<Shipment>,
    @InjectRepository(ShipmentItem)
    private shipmentItemRepo: Repository<ShipmentItem>,
    private mongoService: MongoService,
  ) {}

  private get db(): Db | null {
    return this.mongoService.getDb();
  }

  // ==================== SUMMARY ====================

  async getSummary(orgId: number): Promise<SummaryResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get warehouse count from PostgreSQL
    const totalWarehouses = await this.warehouseRepo.count({
      where: { organizationId: orgId, isActive: true },
    });

    // Get shipment count from PostgreSQL (ใช้ orgId)
    const totalShipments = await this.shipmentRepo.count({
      where: { orgId: orgId },
    });

    // Get movement stats from MongoDB
    let totalIn = 0;
    let totalOut = 0;
    let totalTags = 0;
    let todayIn = 0;
    let todayOut = 0;

    if (this.db) {
      const collection = this.db.collection('TagMovements');

      // Total IN/OUT
      totalIn = await collection.countDocuments({ OrgId: orgId, Action: 'IN' });
      totalOut = await collection.countDocuments({ OrgId: orgId, Action: 'OUT' });

      // Today's movements
      todayIn = await collection.countDocuments({
        OrgId: orgId,
        Action: 'IN',
        Timestamp: { $gte: today },
      });
      todayOut = await collection.countDocuments({
        OrgId: orgId,
        Action: 'OUT',
        Timestamp: { $gte: today },
      });

      // Unique tags count
      const uniqueTags = await collection.distinct('TagUid', { OrgId: orgId });
      totalTags = uniqueTags.length;
    }

    return {
      totalTags,
      totalIn,
      totalOut,
      totalWarehouses,
      totalShipments,
      todayIn,
      todayOut,
    };
  }

  // ==================== DAILY MOVEMENTS ====================

  async getDailyMovements(orgId: number, days: number = 7): Promise<DailyMovement[]> {
    if (!this.db) return [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const pipeline = [
      {
        $match: {
          OrgId: orgId,
          Timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$Timestamp' },
            },
            action: '$Action',
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          movements: {
            $push: {
              action: '$_id.action',
              count: '$count',
            },
          },
        },
      },
      {
        $sort: { _id: 1 as const },
      },
    ];

    const results = await this.db
      .collection('TagMovements')
      .aggregate(pipeline)
      .toArray();

    // Transform to expected format
    const dailyData: DailyMovement[] = [];

    // Generate all dates in range
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const found = results.find((r) => r._id === dateStr);

      let inCount = 0;
      let outCount = 0;

      if (found) {
        const movements = found.movements as Array<{ action: string; count: number }>;
        inCount = movements.find((m) => m.action === 'IN')?.count || 0;
        outCount = movements.find((m) => m.action === 'OUT')?.count || 0;
      }

      dailyData.push({
        date: dateStr,
        IN: inCount,
        OUT: outCount,
      });
    }

    return dailyData;
  }

  // ==================== WAREHOUSE STATS ====================

  async getWarehouseStats(orgId: number): Promise<WarehouseStats[]> {
    // Get warehouses from PostgreSQL
    const warehouses = await this.warehouseRepo.find({
      where: { organizationId: orgId, isActive: true },
    });

    if (!this.db) {
      return warehouses.map((w) => ({
        warehouseId: w.id,
        warehouseName: w.name,
        warehouseCode: w.code,
        tagCount: 0,
        todayIn: 0,
        todayOut: 0,
      }));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats: WarehouseStats[] = [];

    for (const warehouse of warehouses) {
      // Get current tags in warehouse (last action is IN)
      const pipeline = [
        { $match: { OrgId: orgId, WarehouseId: warehouse.id.toString() } },
        { $sort: { Timestamp: -1 as const } },
        {
          $group: {
            _id: '$TagUid',
            lastAction: { $first: '$Action' },
            lastWarehouseId: { $first: '$WarehouseId' },
          },
        },
        {
          $match: {
            lastAction: 'IN',
            lastWarehouseId: warehouse.id.toString(),
          },
        },
        { $count: 'total' },
      ];

      const tagCountResult = await this.db
        .collection('TagMovements')
        .aggregate(pipeline)
        .toArray();

      const tagCount = tagCountResult[0]?.total || 0;

      // Today's IN/OUT for this warehouse
      const todayIn = await this.db.collection('TagMovements').countDocuments({
        OrgId: orgId,
        WarehouseId: warehouse.id.toString(),
        Action: 'IN',
        Timestamp: { $gte: today },
      });

      const todayOut = await this.db.collection('TagMovements').countDocuments({
        OrgId: orgId,
        WarehouseId: warehouse.id.toString(),
        Action: 'OUT',
        Timestamp: { $gte: today },
      });

      stats.push({
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        warehouseCode: warehouse.code,
        tagCount,
        todayIn,
        todayOut,
      });
    }

    return stats;
  }

  // ==================== SHIPMENT STATS ====================

  async getShipmentStats(orgId: number): Promise<ShipmentStats> {
    const pending = await this.shipmentRepo.count({
      where: { orgId: orgId, status: ShipmentStatus.PENDING },
    });

    const inTransit = await this.shipmentRepo.count({
      where: { orgId: orgId, status: ShipmentStatus.IN_TRANSIT },
    });

    const delivered = await this.shipmentRepo.count({
      where: { orgId: orgId, status: ShipmentStatus.DELIVERED },
    });

    return {
      pending,
      inTransit,
      delivered,
      total: pending + inTransit + delivered,
    };
  }

  // ==================== HOURLY ACTIVITY ====================

  async getHourlyActivity(orgId: number, date?: Date): Promise<HourlyActivity[]> {
    if (!this.db) return [];

    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const pipeline = [
      {
        $match: {
          OrgId: orgId,
          Timestamp: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$Timestamp' },
            action: '$Action',
          },
          count: { $sum: 1 },
        },
      },
    ];

    const results = await this.db
      .collection('TagMovements')
      .aggregate(pipeline)
      .toArray();

    // Generate all 24 hours
    const hourlyData: HourlyActivity[] = [];
    for (let h = 0; h < 24; h++) {
      const inResult = results.find(
        (r) => r._id.hour === h && r._id.action === 'IN',
      );
      const outResult = results.find(
        (r) => r._id.hour === h && r._id.action === 'OUT',
      );

      hourlyData.push({
        hour: h,
        IN: (inResult?.count as number) || 0,
        OUT: (outResult?.count as number) || 0,
      });
    }

    return hourlyData;
  }

  // ==================== TOP ACTIVE TAGS ====================

  async getTopActiveTags(orgId: number, limit: number = 10): Promise<{ tagUid: string; movements: number }[]> {
    if (!this.db) return [];

    const pipeline = [
      { $match: { OrgId: orgId } },
      {
        $group: {
          _id: '$TagUid',
          movements: { $sum: 1 },
        },
      },
      { $sort: { movements: -1 as const } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          tagUid: '$_id',
          movements: 1,
        },
      },
    ];

    const results = await this.db
      .collection('TagMovements')
      .aggregate(pipeline)
      .toArray();

    return results as { tagUid: string; movements: number }[];
  }
}