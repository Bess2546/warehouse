// src/tag/tag.service.ts
import { Injectable } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { decodeEyeRaw } from '../eye/eye-decode';
import { extractLocation } from '../common/location-helper';

@Injectable()
export class TagService {
  private db: any;

  constructor() {
    const mongoUrl = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
    const dbName = process.env.MONGO_DB || 'AssetTag';

    const mongo = new MongoClient(mongoUrl);

    mongo
      .connect()
      .then(() => {
        this.db = mongo.db(dbName);
        console.log('[TagService] MongoDB ready');
      })
      .catch((err) => {
        console.error('[TagService] Mongo error:', err);
      });
  }

  // ================== HANDLE SNAPSHOT ================== //
  async handleGatewaySnapshot(payload: any) {
    if (!this.db) {
      console.warn('[TagService] DB not ready');
      return;
    }

    console.log("Incoming EventTime =", payload.EventTime, typeof payload.EventTime);

    const TagScanCol = this.db.collection('TagScanProcessed');
    const TagLastCol = this.db.collection('TagLastSeenProcessed');

    const sourceType = payload.SourceType; // "M5", "Mobile", "Tracker"
    const sourceId = payload.SourceId;
    const eventTime = new Date();
    const orgId = payload.OrgId ?? 0;
    const tags = payload.Tags || [];
    const { lat, lng, hasValidLocation } = extractLocation(payload);

    // ---------- 1) เตรียม tags พร้อม BatteryVoltageMv ที่ decode แล้ว ----------
    const processedTags = tags.map((t: any) => {
      let batteryMv = t.BatteryVoltageMv ?? null;

      // ถ้ามี raw ให้ลอง decode เอาเฉพาะ battery
      if (batteryMv == null && t.raw) {
        try {
          const decoded = decodeEyeRaw(t.raw, { rssi: t.Rssi });
          if (decoded && decoded.batteryMv !== undefined) {
            batteryMv = decoded.batteryMv;
          }
        } catch (e) {
          console.warn('[TagService] decodeEyeRaw error for tag', t.TagUid, e);
        }
      }

      return {
        ...t,
        BatteryVoltageMv: batteryMv,
      };
    });

    // ---------- 2) Save ลง TagScanProcessed (snapshot ตามดิบ ๆ) ----------
    await TagScanCol.insertOne({
      OrgId: orgId,
      SourceType: sourceType,
      SourceId: sourceId,
      EventTime: eventTime,
      Lat: payload.Lat ?? payload.Latitude ?? null,
      Lng: payload.Lng ?? payload.Longitude ?? null,
      Tags: processedTags,
      HasValidLocation: hasValidLocation,
      Note:"",
    });

    // ---------- 3) อัปเดต TagLastSeenProcessed (แค่ last seen) ----------
    for (const t of processedTags) {
      const tagUid = t.TagUid;
      if (!tagUid) {
        console.warn('[TagService] Missing TagUid in snapshot tag:', t);
        continue;
      }

      const update: any = {
        OrgId: orgId,
        TagUid: tagUid,
        BatteryVoltageMv: t.BatteryVoltageMv ?? null,
        EventTime: eventTime,
        LastRssi: t.Rssi,
        Lat:lat,
        Lng:lng,
        SourceType: sourceType,
        SourceId: sourceId,
        Note:"",
      };

      await TagLastCol.updateOne(
        { OrgId: orgId,TagUid: tagUid  },
        {
          $set: update,
        },
        { upsert: true },
      );
    }

    console.log(
      `[TagService] Snapshot processed from ${sourceType}/${sourceId}, tags=${processedTags.length}`,
    );
  }

  // ================== READ APIs ==================

  // tag ที่ยัง Present อยู่ตอนนี้
  async getActiveTags() {
    if (!this.db) return [];
    return this.db
      .collection('TagLastSeenProcessed')
      .find({ Present: true }) // เปลี่ยนเป็น P ใหญ่ให้ตรงกับที่เขียนจริง
      .toArray();
  }

  // ดึง snapshot ล่าสุด ๆ จาก TagScanProcessed
  async getEvents() {
    if (!this.db) return [];
    return this.db
      .collection('TagScanProcessed')
      .find({})
      .sort({ EventTime: -1 })
      .limit(50)
      .toArray();
  }

  // Dashboard summary (ไม่มี in/out แล้ว นับเฉพาะ present + by zone + จำนวน snapshot ใน 24 ชม.)
  async getDashboardSummary() {
    if (!this.db) return null;

    const tagStateCol = this.db.collection('TagLastSeenProcessed');
    const tagScanCol = this.db.collection('TagScanProcessed');

    const present_count = await tagStateCol.countDocuments({ Present: true });
    const total_tags = await tagStateCol.countDocuments({});

    const byZoneAgg = await tagStateCol
      .aggregate([
        { $match: { Present: true } },
        { $group: { _id: '$SourceId', count: { $sum: 1 } } }, 
      ])
      .toArray();

    const by_zone: Record<string, number> = {};
    for (const z of byZoneAgg) {
      by_zone[z._id || 'Unknown'] = z.count;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const scans24h = await tagScanCol.countDocuments({
      EventTime: { $gte: since },
    });

    return {
      present_count,
      total_tags,
      by_zone,
      last24h: { scans: scans24h }, // เดิมเคยมี in/out ตอนนี้เหลือแค่จำนวน scan ใน 24 ชม.
    };
  }

  // ดึงรายการ tag ที่อยู่ในคลังตอนนี้ เรียงตามเวลาที่เห็นล่าสุด
  async getPresentTags(orgId?: number) {
    if (!this.db) return [];

    const filter = orgId ? {OrgId: orgId} : {};

    return this.db
      .collection('TagLastSeenProcessed')
      .find({})
      .sort({ LastSeenTime: -1 })
      .toArray();
  }

  // เดิมเป็น timeline เข้า/ออก ตอนนี้เปลี่ยนเป็น snapshot timeline เฉย ๆ
  async getInOutTimeline(limit = 50) {
    if (!this.db) return [];
    return this.db
      .collection('TagScanProcessed')
      .find({})
      .sort({ EventTime: -1 })
      .limit(limit)
      .toArray();
  }

  // ---------------- WRITE (old per-tag method, ถ้าไม่ใช้แล้วจะลบทิ้งก็ได้) ----------------
  async saveFromMqtt(payload: any) {
    if (!this.db) {
      console.warn('[TagService] DB not ready yet, skip message');
      return;
    }

  

    // แนะนำ: ตอนนี้ให้ใช้ handleGatewaySnapshot แทนฟังก์ชันนี้
    console.warn('[TagService] saveFromMqtt is deprecated, use handleGatewaySnapshot instead');
    await this.handleGatewaySnapshot(payload);
  }
}
