// src/tag/tag.service.ts
import { Injectable } from '@nestjs/common';
import { MongoClient } from 'mongodb';

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

  // ---------------- READ ----------------

  async getActiveTags() {
    if (!this.db) return [];
    return this.db.collection('tag_state').find({ present: true }).toArray();
  }

  async getEvents() {
    if (!this.db) return [];
    return this.db
      .collection('tag_events')
      .find({})
      .sort({ ts: -1 })
      .limit(50)
      .toArray();
  }

  async getDashboardSummary() {
    if (!this.db) return null;

    const tagStateCol = this.db.collection('tag_state');
    const tagEventsCol = this.db.collection('tag_events');

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

    // นับเข้า/ออกใน 24 ชั่วโมงล่าสุด จาก tag_events
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
      .collection('tag_state')
      .find({ present: true })
      .sort({ lastSeen: -1 })
      .toArray();
  }

  // ดึง timeline เข้า/ออกล่าสุด (เฉพาะ enter/exit/move ถ้าต้องการ)
  async getInOutTimeline(limit = 50) {
    if (!this.db) return [];
    return this.db
      .collection('tag_events')
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

    await this.db.collection('tag_state').updateOne(
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

    await this.db.collection('tag_events').insertOne({
      tagId,
      zone,
      rssi,
      ts,
      type: 'seen',
      createdAt: ts,
    });

    console.log('[TagService] Saved MQTT payload to DB:', payload);
  }

  // ---------------- WRITE from snapshot  ----------------
  async updateGatewaySnapshot(
    gwId: string,
    tags: { mac: string; rssi: number; ts?: number }[],
  ) {
    if (!this.db) {
      console.warn('[TagService] DB not ready yet, skip snapshot');
      return;
    }

    const now = new Date();

    // ===== CONFIG สำหรับ timeout + RSSI guard =====
    const MIN_MISS_BEFORE_EXIT = 5; // ต้อง miss อย่างน้อยกี่รอบถึงจะพิจารณา exit
    const EXIT_BASE_TIMEOUT_MS = 90_000; // หายไปอย่างน้อย 30 วิ ถึงจะออก
    const EXIT_STRONG_EXTRA_MS = 90_000; // ถ้า RSSI แรง (> -65) บวกเวลาเพิ่มอีก 20 วิ
    // =============================================

    const macList = tags.map((t) => t.mac);

    const tagStateCol = this.db.collection('tag_state');
    const tagEventsCol = this.db.collection('tag_events');

    // ---------- 1) เตรียม state เดิมใน gateway นี้ ----------
    const prevStatesArr = await tagStateCol.find({ zone: gwId }).toArray();

    const prevMap = new Map<string, any>();
    for (const s of prevStatesArr) {
      prevMap.set(s.tagId, s);
    }

    // ---------- 2) tag ที่ "หาย" จาก snapshot รอบนี้ ----------
    const missingTags = prevStatesArr.filter((s) => !macList.includes(s.tagId));

    for (const prev of missingTags) {
      const newMiss = (prev.missCount || 0) + 1;

      // อัปเดต missCount ก่อน
      await tagStateCol.updateOne(
        { tagId: prev.tagId },
        { $set: { missCount: newMiss } },
      );

      // คำนวณเวลาที่เงียบไปตั้งแต่ lastSeen
      const lastSeenMs = prev.lastSeen ? new Date(prev.lastSeen).getTime() : 0;
      const silenceMs = now.getTime() - lastSeenMs;

      // คำนวณ timeout ตาม RSSI (RSSI guard)
      const prevRssi = prev.rssi ?? -999;
      let timeoutMs = EXIT_BASE_TIMEOUT_MS;
      if (prevRssi > -65) {
        // ถ้าเคยแรงมาก แปลว่าอยู่ใกล้ → ให้ทนมากขึ้น
        timeoutMs += EXIT_STRONG_EXTRA_MS;
      }

      // เงื่อนไข exit:
      // 1) miss อย่างน้อย MIN_MISS_BEFORE_EXIT ครั้ง
      // 2) หายเกิน timeoutMs
      if (
        newMiss >= MIN_MISS_BEFORE_EXIT &&
        silenceMs >= timeoutMs &&
        prev.present !== false
      ) {
        await tagStateCol.updateOne(
          { tagId: prev.tagId },
          {
            $set: {
              present: false,
              lastExit: now,
            },
            $inc: { exitCount: 1 },
          },
        );

        await tagEventsCol.insertOne({
          tagId: prev.tagId,
          zone: gwId,
          type: 'exit',
          ts: now,
          createdAt: now,
        });

        console.log(
          `[TagService] EXIT tag=${prev.tagId} gw=${gwId} missCount=${newMiss} silenceMs=${silenceMs}`,
        );
      } else {
        console.log(
          `[TagService] MISS tag=${prev.tagId} gw=${gwId} miss=${newMiss} silenceMs=${silenceMs}ms (wait more)`,
        );
      }
    }

    // ---------- 3) tag ที่อยู่ใน snapshot รอบนี้ ----------
    for (const t of tags) {
      const tagId = t.mac;
      const rssi = t.rssi;
      const ts = t.ts ? new Date(t.ts) : now;

      const prev = prevMap.get(tagId);
      let eventType: 'enter' | 'move' | 'seen' | null = null;
      let fromZone: string | null = null;

      if (!prev || prev.present === false) {
        eventType = 'enter';
      } else if (prev.zone !== gwId) {
        eventType = 'move';
        fromZone = prev.zone;
      } else {
        eventType = 'seen';
      }

      await tagStateCol.updateOne(
        { tagId },
        {
          $set: {
            tagId,
            zone: gwId,
            rssi,
            present: true,
            lastSeen: ts,
            missCount: 0, // reset เพราะเจอแล้ว
          },
          $setOnInsert: {
            firstSeen: ts,
            enterCount: 0,
            exitCount: 0,
          },
        },
        { upsert: true },
      );

      if (eventType === 'enter') {
        await tagStateCol.updateOne(
          { tagId },
          {
            $set: { lastEnter: ts },
            $inc: { enterCount: 1 },
          },
        );
      }

      await tagEventsCol.insertOne({
        tagId,
        zone: gwId,
        fromZone: fromZone ?? null,
        rssi,
        ts,
        type: eventType,
        createdAt: ts,
      });

      console.log(
        `[TagService] ${eventType?.toUpperCase()} tag=${tagId} gw=${gwId} rssi=${rssi}`,
      );
    }

    console.log(
      `[TagService] Snapshot (debounced) for ${gwId}, tags=${macList.length}`,
    );
  }
}
