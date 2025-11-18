// src/index.ts
// Service เล็ก ๆ: MQTT -> MongoDB (TypeScript)

import 'dotenv/config';
import mqtt, { MqttClient } from 'mqtt';
import { MongoClient, Db, Collection } from 'mongodb';

// ====== Type definitions ======
interface Tag {
  mac: string;
  rssi: number;
}

interface SnapshotPayload {
  gw_id?: string;
  time?: number;
  present_count?: number;
  tags?: Tag[];
}

interface TagState {
  present: boolean;
  last_seen_ts: Date | null;
  miss_count: number;
  gw_id: string;
  last_rssi: number | null;
}

// ====== In-memory state ======
const tagState = new Map<string, TagState>();
const MISS_THRESHOLD = 3;

// ===== อ่าน config จาก .env =====
const MQTT_URL = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883';
const MQTT_SNAPSHOT_TOPIC =
  process.env.MQTT_SNAPSHOT_TOPIC || 'warehouse/ble/+/snapshot';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const MONGO_DB_NAME = process.env.MONGO_DB || 'warehouse';
const SNAPSHOT_COLLECTION =
  process.env.SNAPSHOT_COLLECTION || 'ble_snapshot';
const TAG_COLLECTION = process.env.TAG_COLLECTION || 'ble_tag_seen';

async function start(): Promise<void> {
  console.log('=== MQTT -> MongoDB Service starting... ===');
  console.log('[CONFIG] MQTT_URL:', MQTT_URL);
  console.log('[CONFIG] MONGO_URL:', MONGO_URL);
  console.log('[CONFIG] DB:', MONGO_DB_NAME);

  // ----- เชื่อม MongoDB -----
  const mongoClient = new MongoClient(MONGO_URL);
  await mongoClient.connect();
  console.log('[MongoDB] Connected');

  const db: Db = mongoClient.db(MONGO_DB_NAME);
  const snapshotCol: Collection = db.collection(SNAPSHOT_COLLECTION);
  const tagCol: Collection = db.collection(TAG_COLLECTION);

  // ----- เชื่อม MQTT -----
  const mqttClient: MqttClient = mqtt.connect(MQTT_URL);

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected to', MQTT_URL);
    mqttClient.subscribe(MQTT_SNAPSHOT_TOPIC, (err) => {
      if (err) {
        console.error('[MQTT] Subscribe error:', err);
      } else {
        console.log('[MQTT] Subscribed to', MQTT_SNAPSHOT_TOPIC);
      }
    });
  });

  mqttClient.on('error', (err) => {
    console.error('[MQTT] Error:', err);
  });

  // ----- ตอนมี message เข้ามา -----
  mqttClient.on('message', async (topic, messageBuf) => {
    const payloadText = messageBuf.toString();
    console.log('\n[MQTT] Message on', topic, '=>', payloadText);

    try {
      if (!payloadText.trim()) {
        console.warn('[MQTT] Empty payload, skip');
        return;
      }

      // p: {gw_id, time, present_count, tags:[...]}
      const p = JSON.parse(payloadText) as SnapshotPayload;

      const now = new Date();

      // document หลักเก็บ snapshot 1 รอบ
      const snapshotDoc = {
        gw_id: p.gw_id || 'UNKNOWN',
        ts: now, // เวลา server
        time_sec: p.time ?? null, // เวลาใน GW (วินาที)
        present_count: p.present_count ?? 0,
        tags: p.tags || [],
        topic: topic,
      };

      const snapResult = await snapshotCol.insertOne(snapshotDoc);
      console.log(
        '[MongoDB] Insert snapshot _id =',
        snapResult.insertedId.toHexString(),
      );

      // เก็บราย tag แยก collection ด้วย (optional)
      if (Array.isArray(p.tags) && p.tags.length > 0) {
        const tagDocs = p.tags.map((tag) => ({
          gw_id: p.gw_id || 'UNKNOWN',
          mac: tag.mac,
          rssi: tag.rssi,
          ts: now,
          topic: topic,
        }));

        await tagCol.insertMany(tagDocs);
        console.log(`[MongoDB] Insert ${tagDocs.length} tag doc(s)`);
      }

      // อัปเดต state + events
      await handleSnapshot(p, db, now);
    } catch (err) {
      console.error('[ERROR] handle message failed:', err);
    }
  });

  // ----- cleanup ตอนกด Ctrl+C -----
  process.on('SIGINT', async () => {
    console.log('\n[System] Shutting down...');
    mqttClient.end(true);
    await mongoClient.close();
    process.exit(0);
  });
}

async function handleSnapshot(
  p: SnapshotPayload,
  db: Db,
  now: Date,
): Promise<void> {
  const gwId = p.gw_id || 'UNKNOWN';
  const eventsCol: Collection = db.collection('tag_events');
  const stateCol: Collection = db.collection('tag_state');

  // set ของ mac ที่เจอใน "รอบนี้"
  const seenMacs = new Set<string>();
  const tags: Tag[] = Array.isArray(p.tags) ? p.tags : [];

  // -------- 1) จัดการ tag ที่ "เจอ" ในรอบนี้ --------
  for (const tag of tags) {
    const mac = tag.mac;
    const rssi = tag.rssi;

    if (!mac) continue;
    seenMacs.add(mac);

    let st = tagState.get(mac);
    if (!st) {
      st = {
        present: false,
        last_seen_ts: null,
        miss_count: 0,
        gw_id: gwId,
        last_rssi: null,
      };
    }

    // ถ้ายังไม่ present → ถือว่าเพิ่งเข้ามา (ENTER)
    if (!st.present) {
      await eventsCol.insertOne({
        mac,
        gw_id: gwId,
        type: 'ENTER',
        ts: now,
        rssi,
      });
      st.present = true;
    }

    // อัปเดตสถานะล่าสุด
    st.last_seen_ts = now;
    st.miss_count = 0;
    st.last_rssi = rssi;
    st.gw_id = gwId;

    tagState.set(mac, st);

    // upsert ลง tag_state
    await stateCol.updateOne(
      { mac },
      {
        $set: {
          gw_id: st.gw_id,
          present: st.present,
          last_seen_ts: st.last_seen_ts,
          miss_count: st.miss_count,
          last_rssi: st.last_rssi,
        },
      },
      { upsert: true },
    );
  }

  // -------- 2) จัดการ tag ที่เคย present แต่รอบนี้ "ไม่เจอ" --------
  for (const [mac, st] of tagState.entries()) {
    // ถ้าเดิมทีไม่ได้ present อยู่แล้วก็ข้าม
    if (!st.present) continue;
    // ถ้ารอบนี้ยังเจออยู่ก็ข้าม
    if (seenMacs.has(mac)) continue;

    st.miss_count += 1;

    // ถ้าหายเกิน MISS_THRESHOLD รอบ → LEAVE
    if (st.miss_count >= MISS_THRESHOLD) {
      await eventsCol.insertOne({
        mac,
        gw_id: st.gw_id,
        type: 'LEAVE',
        ts: now,
        rssi: st.last_rssi,
      });
      st.present = false;
      // ยังเก็บ last_seen_ts เป็นของรอบที่เคยเห็นล่าสุด
    }

    tagState.set(mac, st);

    await stateCol.updateOne(
      { mac },
      {
        $set: {
          gw_id: st.gw_id,
          present: st.present,
          last_seen_ts: st.last_seen_ts,
          miss_count: st.miss_count,
          last_rssi: st.last_rssi,
        },
      },
      { upsert: true },
    );
  }
}

start().catch((err) => {
  console.error('Fatal error on start():', err);
  process.exit(1);
});
