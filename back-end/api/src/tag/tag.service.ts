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
    const MISS_THRESHOLD = 3;
    const macList = tags.map((t) => t.mac);

    const tagStateCol = this.db.collection('tag_state');
    const tagEventsCol = this.db.collection('tag_events');

    // ---------- 1) เตรียมข้อมูลเดิมใน gateway นี้ ----------
    // เอา state เดิมของทุก tag ที่อยู่ใน gateway นี้มาเก็บเป็น map
    const prevStatesArr = await tagStateCol.find({ zone: gwId }).toArray();

    const prevMap = new Map<string, any>();
    for (const s of prevStatesArr) {
      prevMap.set(s.tagId, s);
    }

    // ---------- 2) จัดการ tag ที่ไม่อยู่ใน snapshot รอบนี้ (เพิ่ม missCount, detect exit) ----------
    const missingTags = prevStatesArr.filter((s) => !macList.includes(s.tagId));

    for (const prev of missingTags) {
      const newMiss = (prev.missCount || 0) + 1;

      // อัปเดต missCount
      await tagStateCol.updateOne(
        { tagId: prev.tagId },
        {
          $set: { missCount: newMiss },
        },
      );

      // ถ้า missCount เพิ่งถึง threshold -> ถือว่าออก
      if (newMiss >= MISS_THRESHOLD && prev.present !== false) {
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
          type: 'exit', // <- ออกจากคลัง / ออกจาก gateway นี้
          ts: now,
          createdAt: now,
        });

        console.log(
          `[TagService] EXIT tag=${prev.tagId} gw=${gwId} missCount=${newMiss}`,
        );
      }
    }

    // ---------- 3) จัดการ tag ที่อยู่ใน snapshot รอบนี้ (enter/move + seen) ----------
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
            missCount: 0,
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

      // log event ตามประเภท
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
