// src/warehouse/warehouse.service.ts
import { Injectable } from '@nestjs/common';
import { MongoClient, ObjectId } from 'mongodb';

export interface Warehouse {
  _id?: ObjectId;
  OrgId: number;
  Name: string;
  Code: string;
  M5DeviceId: string;       // IMEI ของ M5 ที่ติดตั้งที่ warehouse นี้
  Location?: {
    Lat: number;
    Lng: number;
    Address: string;
  };
  Type: 'ORIGIN' | 'DESTINATION' | 'HUB';
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

@Injectable()
export class WarehouseService {
  private db: any;

  constructor() {
    const mongoUrl = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
    const dbName = process.env.MONGO_DB || 'AssetTag';

    const mongo = new MongoClient(mongoUrl);

    mongo
      .connect()
      .then(() => {
        this.db = mongo.db(dbName);
        console.log('[WarehouseService] MongoDB ready');
        this.ensureIndexes();
      })
      .catch((err) => {
        console.error('[WarehouseService] Mongo error:', err);
      });
  }

  private async ensureIndexes() {
    try {
      const collection = this.db.collection('Warehouses');
      await collection.createIndex({ OrgId: 1 });
      await collection.createIndex({ M5DeviceId: 1 }, { unique: true });
      await collection.createIndex({ Code: 1 });
      console.log('[WarehouseService] Indexes created');
    } catch (err) {
      console.error('[WarehouseService] Index error:', err);
    }
  }

  // ==================== CREATE ====================

  async createWarehouse(warehouse: Omit<Warehouse, '_id' | 'CreatedAt' | 'UpdatedAt'>): Promise<Warehouse> {
    if (!this.db) throw new Error('Database not ready');

    const doc = {
      ...warehouse,
      IsActive: warehouse.IsActive ?? true,
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
    };

    const result = await this.db.collection('Warehouses').insertOne(doc);
    console.log(`[WarehouseService] Created warehouse: ${warehouse.Name}`);

    return { ...doc, _id: result.insertedId };
  }

  // ==================== READ ====================

  // ดึง warehouse ทั้งหมดของ org
  async getWarehouses(orgId: number): Promise<Warehouse[]> {
    if (!this.db) return [];
    return this.db
      .collection('Warehouses')
      .find({ OrgId: orgId, IsActive: true })
      .toArray();
  }

  // ดึง warehouse by ID
  async getWarehouseById(id: string): Promise<Warehouse | null> {
    if (!this.db) return null;
    return this.db
      .collection('Warehouses')
      .findOne({ _id: new ObjectId(id) });
  }

  // ⭐ สำคัญ: หา warehouse จาก M5 Device ID (IMEI)
  async getWarehouseByM5(m5DeviceId: string): Promise<Warehouse | null> {
    if (!this.db) return null;
    return this.db
      .collection('Warehouses')
      .findOne({ M5DeviceId: m5DeviceId, IsActive: true });
  }

  // ดึง warehouse by Code
  async getWarehouseByCode(orgId: number, code: string): Promise<Warehouse | null> {
    if (!this.db) return null;
    return this.db
      .collection('Warehouses')
      .findOne({ OrgId: orgId, Code: code, IsActive: true });
  }

  // ==================== UPDATE ====================

  async updateWarehouse(id: string, update: Partial<Warehouse>): Promise<Warehouse | null> {
    if (!this.db) return null;

    const result = await this.db.collection('Warehouses').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          ...update, 
          UpdatedAt: new Date() 
        } 
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  // ==================== DELETE ====================

  async deleteWarehouse(id: string): Promise<boolean> {
    if (!this.db) return false;

    // Soft delete
    const result = await this.db.collection('Warehouses').updateOne(
      { _id: new ObjectId(id) },
      { $set: { IsActive: false, UpdatedAt: new Date() } }
    );

    return result.modifiedCount > 0;
  }
}