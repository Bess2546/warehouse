  // src/tag-movement/tag-scan-buffer.service.ts
  import { Injectable, Logger } from '@nestjs/common';
  import { MongoClient, ObjectId } from 'mongodb';
  import { TagMovementService } from './tag-movement.service';
import { resolve } from 'path';

  // ==================== CONFIG ====================
  export const MOVEMENT_CONFIG = {
    RSSI_THRESHOLD: -80,        
    
    IN_COUNT_THRESHOLD: 3,        
    IN_TIME_WINDOW_SEC: 60,       
    
    OUT_COUNT_THRESHOLD: 8,      
    OUT_TIMEOUT_SEC: 120,        
    
    // Scan interval (M5 ส่งทุกกี่วินาที)
    SCAN_INTERVAL_SEC: 10,
  };

  // ==================== TYPES ====================
  export interface TagScanBuffer {
    _id?: ObjectId;
    OrgId: number;
    TagUid: string;
    WarehouseId: string;
    WarehouseName: string;
    
    // Scan tracking
    SeenCount: number;            
    MissedCount: number;          
    TotalScans: number;           
    
    // RSSI tracking
    LastRssi: number;
    RssiHistory: number[];       
    AvgRssi: number;
    
    // Timestamps
    FirstSeenTime: Date;         
    LastSeenTime: Date;           
    LastScanTime: Date;           
    
    // Status
    Status: 'TRACKING' | 'CONFIRMED_IN' | 'PENDING_OUT' | 'CONFIRMED_OUT';
    ConfirmedInAt?: Date;
    ConfirmedOutAt?: Date;
    
    // M5 Source
    SourceId: string;
    SourceType: string;
  }

  @Injectable()
  export class TagScanBufferService {
    private readonly logger = new Logger(TagScanBufferService.name);
    private db: any;

    constructor(
      private readonly movementService: TagMovementService,
    ) {
      const mongoUrl = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
      const dbName = process.env.MONGO_DB || 'AssetTag';

      const mongo = new MongoClient(mongoUrl);

      mongo
        .connect()
        .then(() => {
          this.db = mongo.db(dbName);
          this.logger.log('MongoDB ready');
          this.ensureIndexes();
        })
        .catch((err) => {
          this.logger.error('Mongo error:', err);
        });
    }

    private async ensureIndexes() {
      try {
        const collection = this.db.collection('TagScanBuffer');
        await collection.createIndex({ OrgId: 1, TagUid: 1, WarehouseId: 1 }, { unique: true });
        await collection.createIndex({ Status: 1 });
        await collection.createIndex({ LastScanTime: 1 });
        this.logger.log('Indexes created');
      } catch (err) {
        this.logger.error('Index error:', err);
      }
    }

    /**
     * ประมวลผล scan snapshot จาก M5
     * เรียกจาก MqttService ทุกครั้งที่ได้รับ message
     */
    async processScanSnapshot(
      orgId: number,
      warehouseId: string,
      warehouseName: string,
      sourceId: string,
      sourceType: string,
      scannedTags: Array<{ TagUid: string; Rssi: number }>,
    ) {
      if (!this.db) {
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (this.db) break;
          this.logger.warn(`DB not ready, retry ${i+1}/5...`);
        }

        if (!this.db) {
          this.logger.warn('DB not ready after retires,skipping...')
        }
        return;
      }

      const now = new Date();
      const scannedTagUids = scannedTags.map(t => t.TagUid);

      // 1. อัปเดต tags ที่เห็นใน scan นี้
      for (const tag of scannedTags) {
        await this.updateSeenTag(
          orgId,
          warehouseId,
          warehouseName,
          sourceId,
          sourceType,
          tag.TagUid,
          tag.Rssi,
          now,
        );
      }

      // 2. อัปเดต tags ที่ไม่เห็นใน scan นี้ (เฉพาะที่เคย track อยู่)
      await this.updateMissedTags(orgId, warehouseId, scannedTagUids, now);
    }

    /**
     * อัปเดต tag ที่เห็นใน scan
     */
    private async updateSeenTag(
      orgId: number,
      warehouseId: string,
      warehouseName: string,
      sourceId: string,
      sourceType: string,
      tagUid: string,
      rssi: number,
      scanTime: Date,
    ) {
      const collection = this.db.collection('TagScanBuffer');
      const filter = { OrgId: orgId, TagUid: tagUid, WarehouseId: warehouseId };

      // ดึง buffer ปัจจุบัน
      let buffer = await collection.findOne(filter);

      // เช็ค RSSI threshold
      const rssiValid = rssi >= MOVEMENT_CONFIG.RSSI_THRESHOLD;

      if (!buffer) {
        // สร้าง buffer ใหม่
        buffer = {
          OrgId: orgId,
          TagUid: tagUid,
          WarehouseId: warehouseId,
          WarehouseName: warehouseName,
          SeenCount: rssiValid ? 1 : 0,
          MissedCount: 0,
          TotalScans: 1,
          LastRssi: rssi,
          RssiHistory: [rssi],
          AvgRssi: rssi,
          FirstSeenTime: scanTime,
          LastSeenTime: scanTime,
          LastScanTime: scanTime,
          Status: 'TRACKING',
          SourceId: sourceId,
          SourceType: sourceType,
        };

        await collection.insertOne(buffer);
        this.logger.debug(`[Buffer] New tag ${tagUid} at ${warehouseName}, RSSI: ${rssi}`);

      } else {
        // อัปเดต buffer ที่มีอยู่
        const rssiHistory = [...(buffer.RssiHistory || []), rssi].slice(-10); // เก็บ 10 ค่าล่าสุด
        const avgRssi = rssiHistory.reduce((a, b) => a + b, 0) / rssiHistory.length;

        const update: any = {
          $set: {
            LastRssi: rssi,
            RssiHistory: rssiHistory,
            AvgRssi: Math.round(avgRssi),
            LastSeenTime: scanTime,
            LastScanTime: scanTime,
            SourceId: sourceId,
            SourceType: sourceType,
          },
          $inc: {
            TotalScans: 1,
            SeenCount: rssiValid ? 1 : 0,
          },
        };

        // Reset MissedCount เมื่อเห็นอีกครั้ง
        if (rssiValid) {
          update.$set.MissedCount = 0;

          if (buffer.Status === 'PENDING_OUT') {
            update.$set.Status = 'CONFIRMED_IN';
            this.logger.debug(`🔄 [RECOVERED] Tag ${tagUid} back to CONFIRMED_IN at ${warehouseName}`);
          }
        }

        await collection.updateOne(filter, update);

        // เช็คว่าถึง threshold IN หรือยัง
        const updatedBuffer = await collection.findOne(filter);
        await this.checkInThreshold(updatedBuffer);
      }
    }

    /**
     * อัปเดต tags ที่ไม่เห็นใน scan นี้
     */
    private async updateMissedTags(
      orgId: number,
      warehouseId: string,
      scannedTagUids: string[],
      scanTime: Date,
    ) {
      const collection = this.db.collection('TagScanBuffer');

      // หา tags ที่เคย track อยู่แต่ไม่เห็นใน scan นี้
      const trackedTags = await collection.find({
        OrgId: orgId,
        WarehouseId: warehouseId,
        TagUid: { $nin: scannedTagUids },
        Status: { $in: ['TRACKING', 'CONFIRMED_IN', 'PENDING_OUT'] },
      }).toArray();

      for (const buffer of trackedTags) {
        // เพิ่ม MissedCount
        const newMissedCount = (buffer.MissedCount || 0) + 1;

        await collection.updateOne(
          { _id: buffer._id },
          {
            $set: {
              MissedCount: newMissedCount,
              LastScanTime: scanTime,
            },
            $inc: { TotalScans: 1 },
          },
        );

        // เช็คว่าถึง threshold OUT หรือยัง
        await this.checkOutThreshold(buffer, newMissedCount, scanTime);
      }
    }

    /**
     * เช็คว่า tag ถึง threshold IN หรือยัง
     */
    private async checkInThreshold(buffer: TagScanBuffer) {
      if (buffer.Status === 'CONFIRMED_IN' || buffer.Status === 'PENDING_OUT') {
        return;
      }

      const { IN_COUNT_THRESHOLD, RSSI_THRESHOLD } = MOVEMENT_CONFIG;
      if (
        buffer.SeenCount >= IN_COUNT_THRESHOLD &&
        buffer.AvgRssi >= RSSI_THRESHOLD
      ) {
        const collection = this.db.collection('TagScanBuffer');

        // อัปเดต status เป็น CONFIRMED_IN
        await collection.updateOne(
          { _id: buffer._id },
          {
            $set: {
              Status: 'CONFIRMED_IN',
              ConfirmedInAt: new Date(),
            },
          },
        );

        // บันทึก IN ลง TagMovements
        await this.movementService.recordIN(
          buffer.OrgId,
          buffer.TagUid,
          buffer.WarehouseId,
          buffer.WarehouseName,
          buffer.SourceId,
          buffer.SourceType,
        );

        this.logger.log(
          `✅ [IN] Tag ${buffer.TagUid} CONFIRMED IN at ${buffer.WarehouseName} ` +
          `(seen: ${buffer.SeenCount}, avgRSSI: ${buffer.AvgRssi})`
        );
      }
    }

    private async checkOutThreshold(
      buffer: TagScanBuffer,
      missedCount: number,
      scanTime: Date,
    ) {
      if (buffer.Status !== 'CONFIRMED_IN' && buffer.Status !== 'PENDING_OUT') {
        // ยังไม่เคย IN ไม่ต้องทำ OUT
        return;
      }

      const { OUT_COUNT_THRESHOLD, OUT_TIMEOUT_SEC } = MOVEMENT_CONFIG;
      const collection = this.db.collection('TagScanBuffer');

      // เช็ค timeout
      const lastSeenTime = new Date(buffer.LastSeenTime);
      const timeSinceLastSeen = (scanTime.getTime() - lastSeenTime.getTime()) / 1000;

      // เงื่อนไข OUT:
      // 1. ไม่เห็น >= OUT_COUNT_THRESHOLD ครั้งติดต่อกัน
      // 2. หรือไม่เห็นนานเกิน OUT_TIMEOUT_SEC
      if (
        missedCount >= OUT_COUNT_THRESHOLD ||
        timeSinceLastSeen >= OUT_TIMEOUT_SEC
      ) {
        // อัปเดต status เป็น CONFIRMED_OUT
        await collection.updateOne(
          { _id: buffer._id },
          {
            $set: {
              Status: 'CONFIRMED_OUT',
              ConfirmedOutAt: new Date(),
            },
          },
        );

        // บันทึก OUT ลง TagMovements
        await this.movementService.recordOUT(
          buffer.OrgId,
          buffer.TagUid,
          buffer.WarehouseId,
          buffer.WarehouseName,
          buffer.SourceId,
          buffer.SourceType,
        );

        this.logger.log(
          `🚪 [OUT] Tag ${buffer.TagUid} CONFIRMED OUT from ${buffer.WarehouseName} ` +
          `(missed: ${missedCount}, timeout: ${Math.round(timeSinceLastSeen)}s)`
        );

      } else if (buffer.Status === 'CONFIRMED_IN' && missedCount >= 2) {
        // เริ่มเข้าสู่ PENDING_OUT (optional - สำหรับ UI แสดงสถานะ)
        await collection.updateOne(
          { _id: buffer._id },
          { $set: { Status: 'PENDING_OUT' } },
        );

        this.logger.debug(
          `⚠️ [PENDING OUT] Tag ${buffer.TagUid} at ${buffer.WarehouseName} (missed: ${missedCount})`
        );
      }
    }

    // ==================== READ APIs ====================

    /**
     * ดึง buffer ทั้งหมดของ warehouse
     */
    async getBufferByWarehouse(orgId: number, warehouseId: string): Promise<TagScanBuffer[]> {
      if (!this.db) return [];
      return this.db
        .collection('TagScanBuffer')
        .find({ OrgId: orgId, WarehouseId: warehouseId })
        .sort({ LastScanTime: -1 })
        .toArray();
    }

    /**
     * ดึง buffer ของ tag
     */
    async getBufferByTag(orgId: number, tagUid: string): Promise<TagScanBuffer[]> {
      if (!this.db) return [];
      return this.db
        .collection('TagScanBuffer')
        .find({ OrgId: orgId, TagUid: tagUid })
        .toArray();
    }

    /**
     * ดึง tags ที่ CONFIRMED_IN อยู่ใน warehouse
     */
    async getConfirmedInTags(orgId: number, warehouseId: string): Promise<TagScanBuffer[]> {
      if (!this.db) return [];
      return this.db
        .collection('TagScanBuffer')
        .find({
          OrgId: orgId,
          WarehouseId: warehouseId,
          Status: 'CONFIRMED_IN',
        })
        .toArray();
    }

    /**
     * ดึง tags ที่กำลัง PENDING_OUT
     */
    async getPendingOutTags(orgId: number, warehouseId: string): Promise<TagScanBuffer[]> {
      if (!this.db) return [];
      return this.db
        .collection('TagScanBuffer')
        .find({
          OrgId: orgId,
          WarehouseId: warehouseId,
          Status: 'PENDING_OUT',
        })
        .toArray();
    }

    /**
     * สรุปสถานะของ warehouse
     */
    async getWarehouseBufferSummary(orgId: number, warehouseId: string) {
      if (!this.db) return null;

      const collection = this.db.collection('TagScanBuffer');

      const tracking = await collection.countDocuments({
        OrgId: orgId,
        WarehouseId: warehouseId,
        Status: 'TRACKING',
      });

      const confirmedIn = await collection.countDocuments({
        OrgId: orgId,
        WarehouseId: warehouseId,
        Status: 'CONFIRMED_IN',
      });

      const pendingOut = await collection.countDocuments({
        OrgId: orgId,
        WarehouseId: warehouseId,
        Status: 'PENDING_OUT',
      });

      const confirmedOut = await collection.countDocuments({
        OrgId: orgId,
        WarehouseId: warehouseId,
        Status: 'CONFIRMED_OUT',
      });

      return {
        tracking,
        confirmedIn,
        pendingOut,
        confirmedOut,
        totalInWarehouse: confirmedIn + pendingOut, // tags ที่ยังอยู่
      };
    }

    /**
     * Reset buffer ของ tag (สำหรับ manual reset)
     */
    async resetTagBuffer(orgId: number, tagUid: string, warehouseId: string) {
      if (!this.db) return false;

      const result = await this.db.collection('TagScanBuffer').deleteOne({
        OrgId: orgId,
        TagUid: tagUid,
        WarehouseId: warehouseId,
      });

      return result.deletedCount > 0;
    }
  }