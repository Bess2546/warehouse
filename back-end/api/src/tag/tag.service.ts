// src/tag/tag.service.ts
import { Injectable } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { decodeEyeRaw } from '../eye/eye-decode';
import { detectSourceType, macToTagUid } from 'src/common/source-type';

@Injectable()
export class TagService {
  private db: any;

  constructor() {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
    const dbName = process.env.MONGO_DB || 'warehouse';

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

async handleGatewaySnapshot(payload: any) {
  if (!this.db) {
    console.warn('[TagService] DB not ready');
    return;
  }

  const TagScanCol = this.db.collection('TagScanProcessed');
  const TagLastCol = this.db.collection('TagLastSeenProcessed');

  const sourceType = payload.SourceType;
  const sourceId = payload.SourceId;
  const eventTime = payload.EventTime ? new Date(payload.EventTime) : new Date();
  const orgId = payload.OrgId ?? 0;

  const tags = payload.Tags || [];

  // ---------- 1) เตรียม tags พร้อม BatteryVoltageMv ที่ decode แล้ว ----------
  const processedTags = tags.map((t: any) => {
    let batteryMv = t.BatteryVoltageMv ?? null;

    // ถ้า payload ยังไม่มี BatteryVoltageMv แต่มี raw → decode เอาแค่แบต
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

  // ---------- 2) Save ลง TagScanProcessed (เก็บทั้ง event + แบต) ----------
  await TagScanCol.insertOne({
    OrgId: orgId,
    SourceType: sourceType,
    SourceId: sourceId,
    EventTime: eventTime,
    Latitude: payload.Latitude ?? null,
    Longitude: payload.Longitude ?? null,
    Tags: processedTags,
    CreatedAt: new Date(),
  });

  // ---------- 3) ถ้าไม่ใช่ M5 → อัปเดต last seen + battery แค่นั้น (ไม่มี enter/exit) ----------
  if (sourceType !== 'M5') {
    for (const t of processedTags) {
      await TagLastCol.updateOne(
        { TagUid: t.TagUid, OrgId: orgId },
        {
          $set: {
            TagUid: t.TagUid,
            OrgId: orgId,
            LastRssi: t.Rssi,
            LastSeenTime: eventTime,
            LastSourceType: sourceType,
            LastSourceId: sourceId,
            BatteryVoltageMv: t.BatteryVoltageMv ?? null,
            Present: true,
          },
          $setOnInsert: {
            FirstSeenTime: eventTime,
          },
        },
        { upsert: true },
      );
    }

    console.log(
      `[TagService] Snapshot (non-M5) processed from ${sourceType}/${sourceId}`,
    );
    return;
  }

  // ---------- 4) ถ้าเป็น M5 → ใช้ logic เข้า/ออกคลังด้วย ----------
  const zone = sourceId; // ใช้ SourceId ของ M5 แทน zone เช่น GW_A01

  // ดึง state เดิมของ tag ที่เคยอยู่ในโซนนี้
  const prevStates = await TagLastCol
    .find({ OrgId: orgId, LastZone: zone })
    .toArray();

  const prevMap = new Map<string, any>();
  for (const s of prevStates) {
    prevMap.set(s.TagUid, s);
  }

  const nowMs = Date.now();
  const EXIT_TIMEOUT_MS = 30_000;
  const MIN_MISS_BEFORE_EXIT = 3;

  const newTagUids = processedTags.map((t) => t.TagUid);

  // ---------- 4.1 ตรวจ tag ที่ "หาย" ไปจาก snapshot รอบนี้ (candidate for exit) ----------
  for (const prev of prevStates) {
    if (!newTagUids.includes(prev.TagUid)) {
      const newMiss = (prev.MissCount ?? 0) + 1;

      await TagLastCol.updateOne(
        { TagUid: prev.TagUid, OrgId: orgId },
        { $set: { MissCount: newMiss } },
      );

      const lastSeenMs = prev.LastSeenTime
        ? new Date(prev.LastSeenTime).getTime()
        : 0;
      const silenceMs = nowMs - lastSeenMs;

      if (
        newMiss >= MIN_MISS_BEFORE_EXIT &&
        silenceMs >= EXIT_TIMEOUT_MS &&
        prev.Present !== false
      ) {
        await TagLastCol.updateOne(
          { TagUid: prev.TagUid, OrgId: orgId },
          {
            $set: {
              Present: false,
              LastExit: new Date(),
            },
            $inc: { ExitCount: 1 },
          },
        );

        console.log(
          `[TagService] EXIT TagUid=${prev.TagUid} zone=${zone} miss=${newMiss} silence=${silenceMs}ms`,
        );
      } else {
        console.log(
          `[TagService] MISS TagUid=${prev.TagUid} zone=${zone} miss=${newMiss} silence=${silenceMs}ms`,
        );
      }
    }
  }

  // ---------- 4.2 จัดการ tag ที่เจอใน snapshot รอบนี้ (enter / move / seen) ----------
  for (const t of processedTags) {
    const tagUid = t.TagUid;
    const prev = prevMap.get(tagUid);

    let eventType: 'enter' | 'move' | 'seen' = 'seen';

    if (!prev || prev.Present === false) {
      eventType = 'enter';
    } else if (prev.LastZone !== zone) {
      eventType = 'move';
    } else {
      eventType = 'seen';
    }

    await TagLastCol.updateOne(
      { TagUid: tagUid, OrgId: orgId },
      {
        $set: {
          TagUid: tagUid,
          OrgId: orgId,
          LastRssi: t.Rssi,
          LastSeenTime: eventTime,
          LastSourceType: 'M5',
          LastSourceId: zone,
          LastZone: zone,
          BatteryVoltageMv: t.BatteryVoltageMv ?? null,
          Present: true,
          MissCount: 0, // reset เพราะเจอแล้ว
        },
        $setOnInsert: {
          FirstSeenTime: eventTime,
          EnterCount: 0,
          ExitCount: 0,
        },
      },
      { upsert: true },
    );

    if (eventType === 'enter') {
      await TagLastCol.updateOne(
        { TagUid: tagUid, OrgId: orgId },
        {
          $set: { LastEnter: eventTime },
          $inc: { EnterCount: 1 },
        },
      );
    }

    console.log(
      `[TagService] ${eventType.toUpperCase()} TagUid=${tagUid} zone=${zone} batt=${t.BatteryVoltageMv ?? 'null'}`,
    );
  }

  console.log(
    `[TagService] Snapshot (M5) processed for zone=${sourceId}, tags=${processedTags.length}`,
  );
}

  // ---------------- READ ----------------
  async getActiveTags() {
    if (!this.db) return [];
    return this.db.collection('TagLastSeenProcessed').find({ present: true }).toArray();
  }

  async getEvents() {
    if (!this.db) return [];
    return this.db
      .collection('TagScanProcessed')
      .find({})
      .sort({ ts: -1 })
      .limit(50)
      .toArray();
  }

  async getDashboardSummary() {
    if (!this.db) return null;

    const tagStateCol = this.db.collection('TagLastSeenProcessed');
    const tagEventsCol = this.db.collection('TagScanProcessed');

    const present_count = await tagStateCol.countDocuments({ present: true });
    const total_tags = await tagStateCol.countDocuments({});

    const byZoneAgg = await tagStateCol
      .aggregate([
        { $match: { present: true } },
        { $group: { _id: '$zone', count: { $sum: 1 } } },
      ])
      .toArray();

    const by_zone: Record<string, number> = {};
    for (const z of byZoneAgg) {
      by_zone[z._id || 'Unknown'] = z.count;
    }

    // นับเข้า/ออกใน 24 ชั่วโมงล่าสุด จาก TagScanProcessed
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const in24 = await tagEventsCol.countDocuments({
      type: 'enter',
      ts: { $gte: since },
    });
    const out24 = await tagEventsCol.countDocuments({
      type: 'exit',
      ts: { $gte: since },
    });

    return {
      present_count,
      total_tags,
      by_zone,
      last24h: { in: in24, out: out24 },
    };
  }

  // ดึงรายการ tag ที่อยู่ในคลังตอนนี้ (present=true)
  async getPresentTags() {
    if (!this.db) return [];
    return this.db
      .collection('TagLastSeenProcessed')
      .find({ present: true })
      .sort({ lastSeen: -1 })
      .toArray();
  }

  // ดึง timeline เข้า/ออกล่าสุด (เฉพาะ enter/exit/move ถ้าต้องการ)
  async getInOutTimeline(limit = 50) {
    if (!this.db) return [];
    return this.db
      .collection('TagScanProcessed')
      .find({ type: { $in: ['enter', 'exit'] } })
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();
  }

  // ---------------- WRITE (old per-tag method, ยังเก็บไว้ใช้ได้) ----------------
  async saveFromMqtt(payload: any) {
    if (!this.db) {
      console.warn('[TagService] DB not ready yet, skip message');
      return;
    }

    const tagId = payload.mac;
    const zone = payload.gw_id;
    const rssi = payload.rssi;
    const ts = payload.ts ? new Date(payload.ts) : new Date();

    if (!tagId) {
      console.warn('[TagService] Missing tagId in payload:', payload);
      return;
    }

    await this.db.collection('TagLastSeenProcessed').updateOne(
      { tagId },
      {
        $set: {
          tagId,
          zone,
          rssi,
          present: true,
          lastSeen: ts,
        },
      },
      { upsert: true },
    );

    await this.db.collection('TagScanProcessed').insertOne({
      tagId,
      zone,
      rssi,
      ts,
      type: 'seen',
      createdAt: ts,
    });

    console.log('[TagService] Saved MQTT payload to DB:', payload);
  }

}
