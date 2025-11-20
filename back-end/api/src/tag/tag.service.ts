// src/tag/tag.service.ts
import { Injectable } from '@nestjs/common';
import { MongoClient } from 'mongodb';

@Injectable()
export class TagService {
  private db: any;

  constructor() {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
    const dbName   = process.env.MONGO_DB   || 'warehouse';

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
    return this.db
      .collection('tag_state')
      .find({ present: true })
      .toArray();
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

  // ---------------- WRITE from MQTT ----------------
  // 👇 เมธอดนี้แหละที่ MQTT จะเรียก
  async saveFromMqtt(payload: any) {
    if (!this.db) {
      console.warn('[TagService] DB not ready yet, skip message');
      return;
    }

    // ปรับ field ให้ตรงกับ payload จริงที่ Node-RED ส่งมา
    const tagId = payload.mac;
    const zone  = payload.gw_id;
    const rssi  = payload.rssi;
    const ts    = payload.ts ? new Date(payload.ts) : new Date();

    if (!tagId) {
      console.warn('[TagService] Missing tagId in payload:', payload);
      return;
    }

    // 1) เก็บสถานะล่าสุดของ tag
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

    // 2) เก็บ log เหตุการณ์
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
}
