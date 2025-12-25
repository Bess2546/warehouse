// src/tag-movement/tag-movement.service.ts
import { Injectable } from '@nestjs/common';
import { MongoClient, ObjectId } from 'mongodb';

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
  private db: any;

  constructor() {
    const mongoUrl = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
    const dbName = process.env.MONGO_DB || 'AssetTag';

    const mongo = new MongoClient(mongoUrl);

    mongo
      .connect()
      .then(() => {
        this.db = mongo.db(dbName);
        console.log('[TagMovementService] MongoDB ready');
        this.ensureIndexes();
      })
      .catch((err) => {
        console.error('[TagMovementService] Mongo error:', err);
      });
  }

  // สร้าง indexes สำหรับ query ที่เร็วขึ้น
  private async ensureIndexes() {
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

  // บันทึก movement ใหม่
  async recordMovement(movement: Omit<TagMovement, '_id'>): Promise<TagMovement> {
    if (!this.db) {
      throw new Error('Database not ready');
    }

    const doc = {
      ...movement,
      Timestamp: movement.Timestamp || new Date(),
    };

    const result = await this.db.collection('TagMovements').insertOne(doc);
    
    console.log(`[TagMovementService] Recorded ${movement.Action} for tag ${movement.TagUid} at ${movement.WarehouseName}`);
    
    return { ...doc, _id: result.insertedId };
  }

  // บันทึก IN - เมื่อ tag เข้า warehouse
  async recordIN(
    orgId: number,
    tagUid: string,
    warehouseId: string,
    warehouseName: string,
    sourceId: string,
    sourceType: string = 'M5',
    shipmentId?: string,
  ): Promise<TagMovement> {
    return this.recordMovement({
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
  }

  // บันทึก OUT - เมื่อ tag ออกจาก warehouse
  async recordOUT(
    orgId: number,
    tagUid: string,
    warehouseId: string,
    warehouseName: string,
    sourceId: string,
    sourceType: string = 'M5',
    shipmentId?: string,
  ): Promise<TagMovement> {
    return this.recordMovement({
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
  }

  // ==================== READ ====================

  // ดึงประวัติ movement ทั้งหมดของ tag
  async getMovementsByTag(orgId: number, tagUid: string, limit: number = 50): Promise<TagMovement[]> {
    if (!this.db) return [];

    return this.db
      .collection('TagMovements')
      .find({ OrgId: orgId, TagUid: tagUid })
      .sort({ Timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  // ดึงประวัติ movement ของ warehouse
  async getMovementsByWarehouse(orgId: number, warehouseId: string, limit: number = 50): Promise<TagMovement[]> {
    if (!this.db) return [];

    return this.db
      .collection('TagMovements')
      .find({ OrgId: orgId, WarehouseId: warehouseId })
      .sort({ Timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  // ดึง movement ล่าสุดทั้งหมด (สำหรับ dashboard)
  async getRecentMovements(orgId: number, limit: number = 50): Promise<TagMovement[]> {
    if (!this.db) return [];

    return this.db
      .collection('TagMovements')
      .find({ OrgId: orgId })
      .sort({ Timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  // ดึง movement ล่าสุดของ tag (รู้ว่าอยู่ที่ไหนล่าสุด)
  async getLastMovement(orgId: number, tagUid: string): Promise<TagMovement | null> {
    if (!this.db) return null;

    return this.db
      .collection('TagMovements')
      .findOne(
        { OrgId: orgId, TagUid: tagUid },
        { sort: { Timestamp: -1 } }
      );
  }

  // ดึง tags ที่อยู่ใน warehouse ตอนนี้
  async getTagsInWarehouse(orgId: number, warehouseId: string): Promise<string[]> {
    if (!this.db) return [];

    // หา last movement ของแต่ละ tag แล้วเช็คว่า IN อยู่ที่ warehouse นี้ไหม
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

  // สรุปข้อมูล movement ของ tag
  async getTagSummary(orgId: number, tagUid: string): Promise<MovementSummary> {
    if (!this.db) {
      return { totalIn: 0, totalOut: 0, currentInWarehouse: 0 };
    }

    const movements = await this.db
      .collection('TagMovements')
      .find({ OrgId: orgId, TagUid: tagUid })
      .toArray();

    const totalIn = movements.filter((m: TagMovement) => m.Action === 'IN').length;
    const totalOut = movements.filter((m: TagMovement) => m.Action === 'OUT').length;
    const lastMovement = await this.getLastMovement(orgId, tagUid);

    return {
      totalIn,
      totalOut,
      currentInWarehouse: lastMovement?.Action === 'IN' ? 1 : 0,
      lastMovement: lastMovement || undefined,
    };
  }

  // สรุปข้อมูล movement ของ warehouse
  async getWarehouseSummary(orgId: number, warehouseId: string) {
    if (!this.db) {
      return { totalIn: 0, totalOut: 0, currentCount: 0, todayIn: 0, todayOut: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const movements = await this.db
      .collection('TagMovements')
      .find({ OrgId: orgId, WarehouseId: warehouseId })
      .toArray();

    const totalIn = movements.filter((m: TagMovement) => m.Action === 'IN').length;
    const totalOut = movements.filter((m: TagMovement) => m.Action === 'OUT').length;
    const todayIn = movements.filter((m: TagMovement) => 
      m.Action === 'IN' && new Date(m.Timestamp) >= today
    ).length;
    const todayOut = movements.filter((m: TagMovement) => 
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

  // สรุป movement ทั้งระบบ
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

  // ดึง movements ตามช่วงเวลา
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

    return this.db
      .collection('TagMovements')
      .find(query)
      .sort({ Timestamp: -1 })
      .toArray();
  }
}