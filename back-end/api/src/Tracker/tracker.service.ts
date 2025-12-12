// src/tracker/tracker.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MongoClient, Db, Collection } from 'mongodb';

export interface Tracker {
  id: number;
  imei: string;
  serialNumber: string;
  simNumber?: string;
  brand?: string;
  model?: string;
  description?: string;
  version?: string;
  organizeId?: number;
  organizeName?: string;
  vehicleId?: number;
  vehiclePlate?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'STOCKED';
  lastSeen?: Date;
  lastBattery?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organize {
  id: number;
  name: string;
  address?: string;
  addressInvoice?: string;
  phone?: string;
  email?: string;
  isDeleted: boolean;
  type?: string;
  tinNumber?: string;
  note?: string;
}

@Injectable()
export class TrackerService {
  private readonly logger = new Logger(TrackerService.name);
  private db: Db | null = null;

  constructor() {
    const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGO_DB || 'warehouse';

    const mongo = new MongoClient(mongoUrl);

    mongo
      .connect()
      .then(() => {
        this.db = mongo.db(dbName);
        this.logger.log('MongoDB ready');
      })
      .catch((err) => {
        this.logger.error('Mongo error:', err);
      });
  }

  private trackerCol(): Collection<Tracker> | null {
    if (!this.db) return null;
    return this.db.collection<Tracker>('trackers');
  }

  private organizeCol(): Collection<Organize> | null {
    if (!this.db) return null;
    return this.db.collection<Organize>('organizes');
  }

  // ==================== GET ORGANIZE BY M5 IMEI ====================
  async getOrganizeByM5(imei: string): Promise<{ data: Organize | null; message: string; isSuccess: boolean }> {
    if (!imei) {
      return { data: null, message: 'IMEI is required', isSuccess: false };
    }

    const trackerCol = this.trackerCol();
    const organizeCol = this.organizeCol();

    if (!trackerCol || !organizeCol) {
      return { data: null, message: 'Database not ready', isSuccess: false };
    }

    // หา Tracker จาก IMEI
    const tracker = await trackerCol.findOne({ imei, isActive: true });

    if (!tracker) {
      this.logger.warn(`Tracker not found for IMEI: ${imei}`);
      return { data: null, message: 'Tracker not found', isSuccess: false };
    }

    if (!tracker.organizeId) {
      this.logger.warn(`Tracker ${imei} has no organizeId`);
      return { data: null, message: 'Tracker has no organize assigned', isSuccess: false };
    }

    // หา Organize จาก organizeId
    const organize = await organizeCol.findOne({ id: tracker.organizeId, isActive: true });

    if (!organize) {
      this.logger.warn(`Organize not found for id: ${tracker.organizeId}`);
      return { data: null, message: 'Organize not found', isSuccess: false };
    }

    this.logger.log(`Found organize for IMEI ${imei}: ${organize.name}`);

    return {
      data: {
        id: organize.id,
        name: organize.name,
        address: organize.address,
        addressInvoice: organize.addressInvoice,
        phone: organize.phone,
        email: organize.email,
        isDeleted: organize.isDeleted ?? false,
        type: organize.type,
        tinNumber: organize.tinNumber,
        note: organize.note,
      },
      message: 'Success',
      isSuccess: true,
    };
  }

  // ==================== GET ALL TRACKERS ====================
  async getAllTrackers(): Promise<Tracker[]> {
    const col = this.trackerCol();
    if (!col) return [];
    return col.find({ isActive: true }).sort({ id: 1 }).toArray();
  }

  // ==================== GET TRACKER BY IMEI ====================
  async getTrackerByImei(imei: string): Promise<Tracker | null> {
    const col = this.trackerCol();
    if (!col) return null;
    return col.findOne({ imei, isActive: true });
  }

  // ==================== ADD SINGLE TRACKER ====================
  async addTracker(data: {
    serial: string;
    imei: string;
    brand?: string;
    model?: string;
    description?: string;
    version?: string;
  }): Promise<{ isSuccess: boolean; message: string; imei?: string }> {
    const col = this.trackerCol();
    if (!col) {
      return { isSuccess: false, message: 'Database not ready' };
    }

    // Check duplicate IMEI
    const existing = await col.findOne({ imei: data.imei });
    if (existing) {
      return { isSuccess: false, message: 'IMEI already exists', imei: data.imei };
    }

    // Generate next ID
    const last = await col.find().sort({ id: -1 }).limit(1).toArray();
    const nextId = last.length > 0 ? last[0].id + 1 : 1;

    const now = new Date();
    const newTracker: Tracker = {
      id: nextId,
      imei: data.imei,
      serialNumber: data.serial,
      brand: data.brand,
      model: data.model,
      description: data.description,
      version: data.version,
      status: 'STOCKED',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await col.insertOne(newTracker);
    this.logger.log(`Added tracker: ${data.imei}`);

    return { isSuccess: true, message: 'Tracker added successfully', imei: data.imei };
  }

  // ==================== ADD BATCH TRACKERS ====================
  async addBatchTrackers(trackers: Array<{
    Serial: string;
    Imie: string;
    Brand?: string;
    Model?: string;
    Description?: string;
    Version?: string;
  }>): Promise<Array<{ imie: string; isSuccess: boolean; errorMessage?: string }>> {
    const results: Array<{ imie: string; isSuccess: boolean; errorMessage?: string }> = [];

    for (const t of trackers) {
      const result = await this.addTracker({
        serial: t.Serial,
        imei: t.Imie,
        brand: t.Brand,
        model: t.Model,
        description: t.Description,
        version: t.Version,
      });

      results.push({
        imie: t.Imie,
        isSuccess: result.isSuccess,
        errorMessage: result.isSuccess ? undefined : result.message,
      });
    }

    return results;
  }

  // ==================== ASSIGN TRACKER TO ORGANIZE ====================
  async assignToOrganize(imei: string, organizeId: number): Promise<{ isSuccess: boolean; message: string }> {
    const trackerCol = this.trackerCol();
    const organizeCol = this.organizeCol();

    if (!trackerCol || !organizeCol) {
      return { isSuccess: false, message: 'Database not ready' };
    }

    // Check tracker exists
    const tracker = await trackerCol.findOne({ imei, isActive: true });
    if (!tracker) {
      return { isSuccess: false, message: 'Tracker not found' };
    }

    // Check organize exists
    const organize = await organizeCol.findOne({ id: organizeId, isActive: true });
    if (!organize) {
      return { isSuccess: false, message: 'Organize not found' };
    }

    // Update tracker
    await trackerCol.updateOne(
      { imei },
      {
        $set: {
          organizeId: organize.id,
          organizeName: organize.name,
          status: 'ACTIVE',
          updatedAt: new Date(),
        },
      },
    );

    this.logger.log(`Assigned tracker ${imei} to organize ${organize.name}`);
    return { isSuccess: true, message: 'Tracker assigned successfully' };
  }

  // ==================== UPDATE TRACKER STATUS ====================
  async updateStatus(imei: string, status: Tracker['status']): Promise<{ isSuccess: boolean; message: string }> {
    const col = this.trackerCol();
    if (!col) {
      return { isSuccess: false, message: 'Database not ready' };
    }

    const result = await col.updateOne(
      { imei, isActive: true },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return { isSuccess: false, message: 'Tracker not found' };
    }

    return { isSuccess: true, message: 'Status updated successfully' };
  }
}