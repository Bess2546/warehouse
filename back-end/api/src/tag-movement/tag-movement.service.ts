// src/tag-movement/tag-movement.service.ts
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ObjectId, Db } from 'mongodb';
import { ShipmentsService } from "../shipments/shipments.service";
import { MongoService } from "../common/mongo.service";

export interface TagMovement {
  _id?: ObjectId;
  OrgId: number;
  TagUid: string;
  Action: 'IN' | 'OUT';
  Timestamp: Date;
  WarehouseId: string;
  WarehouseName: string;
  SourceId: string;
  SourceType: string;
  ShipmentId?: string;
  Note?: string;
}

export interface MovementSummary {
  totalIn: number;
  totalOut: number;
  currentInWarehouse: number;
  lastMovement?: TagMovement;
}

@Injectable()
export class TagMovementService {

  constructor(
    @Inject(forwardRef(() => ShipmentsService))
    private shipmentsService: ShipmentsService,
    private mongoService: MongoService,
  ) {
    this.initIndexes();
  }

  private get db(): Db | null {
    return this.mongoService.getDb();
  }

  private async initIndexes() {
    const ready = await this.mongoService.waitForConnection();
    if (!ready || !this.db) {
      console.error('[TagMovementService] Cannot create indexes - DB not ready');
      return;
    }
    await this.ensureIndexes();
  }

  private async ensureIndexes() {
    if (!this.db) return;
    
    try {
      const collection = this.db.collection('TagMovements');
      await collection.createIndex({ OrgId: 1, TagUid: 1 });
      await collection.createIndex({ OrgId: 1, Timestamp: -1 });
      await collection.createIndex({ OrgId: 1, WarehouseId: 1 });
      await collection.createIndex({ TagUid: 1, Timestamp: -1 });
      console.log('[TagMovementService] Indexes created');
    } catch (err) {
      console.error('[TagMovementService] Index error:', err);
    }
  }

  // ==================== CREATE ====================

  async recordMovement(movement: Omit<TagMovement, '_id'>): Promise<TagMovement> {
    const ready = await this.mongoService.waitForConnection();
    if (!ready || !this.db) {
      throw new Error('Database not ready after retries');
    }

    const doc = {
      ...movement,
      Timestamp: movement.Timestamp || new Date(),
    };

    const result = await this.db.collection('TagMovements').insertOne(doc);

    console.log(`[TagMovementService] Recorded ${movement.Action} for tag ${movement.TagUid} at ${movement.WarehouseName}`);

    return { ...doc, _id: result.insertedId } as TagMovement;
  }

  async recordIN(
    orgId: number,
    tagUid: string,
    warehouseId: string,
    warehouseName: string,
    sourceId: string,
    sourceType: string = 'M5',
    shipmentId?: string,
  ): Promise<TagMovement> {
    const movement = await this.recordMovement({
      OrgId: orgId,
      TagUid: tagUid,
      Action: 'IN',
      Timestamp: new Date(),
      WarehouseId: warehouseId,
      WarehouseName: warehouseName,
      SourceId: sourceId,
      SourceType: sourceType,
      ShipmentId: shipmentId,
    });

    await this.shipmentsService.onTagMovement(
      tagUid,
      'IN',
      parseInt(warehouseId),
      orgId,
    );

    return movement;
  }

  async recordOUT(
    orgId: number,
    tagUid: string,
    warehouseId: string,
    warehouseName: string,
    sourceId: string,
    sourceType: string = 'M5',
    shipmentId?: string,
  ): Promise<TagMovement> {
    const movement = await this.recordMovement({
      OrgId: orgId,
      TagUid: tagUid,
      Action: 'OUT',
      Timestamp: new Date(),
      WarehouseId: warehouseId,
      WarehouseName: warehouseName,
      SourceId: sourceId,
      SourceType: sourceType,
      ShipmentId: shipmentId,
    });

    await this.shipmentsService.onTagMovement(
      tagUid,
      'OUT',
      parseInt(warehouseId),
      orgId,
    );

    return movement;
  }

  // ==================== READ ====================

  async getMovementsByTag(orgId: number, tagUid: string, limit: number = 50): Promise<TagMovement[]> {
    if (!this.db) return [];

    const results = await this.db
      .collection('TagMovements')
      .find({ OrgId: orgId, TagUid: tagUid })
      .sort({ Timestamp: -1 })
      .limit(limit)
      .toArray();

    return results as unknown as TagMovement[];
  }

  async getMovementsByWarehouse(orgId: number, warehouseId: string, limit: number = 50): Promise<TagMovement[]> {
    if (!this.db) return [];

    const results = await this.db
      .collection('TagMovements')
      .find({ OrgId: orgId, WarehouseId: warehouseId })
      .sort({ Timestamp: -1 })
      .limit(limit)
      .toArray();

    return results as unknown as TagMovement[];
  }

  async getRecentMovements(orgId: number, limit: number = 50): Promise<TagMovement[]> {
    if (!this.db) return [];

    const results = await this.db
      .collection('TagMovements')
      .find({ OrgId: orgId })
      .sort({ Timestamp: -1 })
      .limit(limit)
      .toArray();

    return results as unknown as TagMovement[];
  }

  async getLastMovement(orgId: number, tagUid: string): Promise<TagMovement | null> {
    if (!this.db) return null;

    const result = await this.db
      .collection('TagMovements')
      .findOne(
        { OrgId: orgId, TagUid: tagUid },
        { sort: { Timestamp: -1 } }
      );

    return result as unknown as TagMovement | null;
  }

  async getTagsInWarehouse(orgId: number, warehouseId: string): Promise<string[]> {
    if (!this.db) return [];

    const pipeline = [
      { $match: { OrgId: orgId } },
      { $sort: { Timestamp: -1 } },
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
          lastWarehouseId: warehouseId,
        },
      },
    ];

    const results = await this.db.collection('TagMovements').aggregate(pipeline).toArray();
    return results.map((r: any) => r._id);
  }

  // ==================== SUMMARY ====================

  async getTagSummary(orgId: number, tagUid: string): Promise<MovementSummary> {
    if (!this.db) {
      return { totalIn: 0, totalOut: 0, currentInWarehouse: 0 };
    }

    const movements = await this.db
      .collection('TagMovements')
      .find({ OrgId: orgId, TagUid: tagUid })
      .toArray() as unknown as TagMovement[];

    const totalIn = movements.filter((m) => m.Action === 'IN').length;
    const totalOut = movements.filter((m) => m.Action === 'OUT').length;
    const lastMovement = await this.getLastMovement(orgId, tagUid);

    return {
      totalIn,
      totalOut,
      currentInWarehouse: lastMovement?.Action === 'IN' ? 1 : 0,
      lastMovement: lastMovement || undefined,
    };
  }

  async getWarehouseSummary(orgId: number, warehouseId: string) {
    if (!this.db) {
      return { totalIn: 0, totalOut: 0, currentCount: 0, todayIn: 0, todayOut: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const movements = await this.db
      .collection('TagMovements')
      .find({ OrgId: orgId, WarehouseId: warehouseId })
      .toArray() as unknown as TagMovement[];

    const totalIn = movements.filter((m) => m.Action === 'IN').length;
    const totalOut = movements.filter((m) => m.Action === 'OUT').length;
    const todayIn = movements.filter((m) =>
      m.Action === 'IN' && new Date(m.Timestamp) >= today
    ).length;
    const todayOut = movements.filter((m) =>
      m.Action === 'OUT' && new Date(m.Timestamp) >= today
    ).length;

    const currentTags = await this.getTagsInWarehouse(orgId, warehouseId);

    return {
      totalIn,
      totalOut,
      currentCount: currentTags.length,
      todayIn,
      todayOut,
    };
  }

  async getOverallSummary(orgId: number) {
    if (!this.db) {
      return { totalMovements: 0, totalIn: 0, totalOut: 0, todayMovements: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalMovements = await this.db
      .collection('TagMovements')
      .countDocuments({ OrgId: orgId });

    const totalIn = await this.db
      .collection('TagMovements')
      .countDocuments({ OrgId: orgId, Action: 'IN' });

    const totalOut = await this.db
      .collection('TagMovements')
      .countDocuments({ OrgId: orgId, Action: 'OUT' });

    const todayMovements = await this.db
      .collection('TagMovements')
      .countDocuments({ OrgId: orgId, Timestamp: { $gte: today } });

    return {
      totalMovements,
      totalIn,
      totalOut,
      todayMovements,
    };
  }

  // ==================== FILTER BY DATE ====================

  async getMovementsByDateRange(
    orgId: number,
    startDate: Date,
    endDate: Date,
    warehouseId?: string,
  ): Promise<TagMovement[]> {
    if (!this.db) return [];

    const query: any = {
      OrgId: orgId,
      Timestamp: { $gte: startDate, $lte: endDate },
    };

    if (warehouseId) {
      query.WarehouseId = warehouseId;
    }

    const results = await this.db
      .collection('TagMovements')
      .find(query)
      .sort({ Timestamp: -1 })
      .toArray();

    return results as unknown as TagMovement[];
  }
}