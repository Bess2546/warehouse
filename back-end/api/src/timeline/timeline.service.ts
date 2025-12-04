// src/timeline/timeline.service.ts
import { Injectable } from '@nestjs/common';
import { MongoClient, Db, Collection } from 'mongodb';

export type TimelineStatus =
  | 'ON_TIME'
  | 'DELAY_ARRIVAL'
  | 'DELAY_DEPARTURE'
  | 'EARLY'
  | 'UNKNOWN';

export interface TimelineEvent {
  _id?: any;

  tripId: string;          // รหัส trip / shipment เช่น TRIP2025-001
  stopSeq?: number;        // ลำดับจุดที่ 1,2,3,...
  organizeId?: number;     // ไว้ผูกกับ Organize ถ้าต้องใช้
  organizeName: string;    // BKK Hub, JB Border, ...

  eta?: Date;              // แผนถึง
  ata?: Date;              // ถึงจริง
  etd?: Date;              // แผนออก
  atd?: Date;              // ออกจริง

  arrivalDelayMin?: number;    // นาทีที่ดีเลย์ตอนถึง
  departureDelayMin?: number;  // นาทีที่ดีเลย์ตอนออก

  status?: TimelineStatus;     // ON_TIME / DELAY_ARRIVAL / ...

  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TimelineService {
  private db: Db | null = null;

  constructor() {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
    const dbName = process.env.MONGO_DB || 'warehouse';

    const mongo = new MongoClient(mongoUrl);

    mongo
      .connect()
      .then(() => {
        this.db = mongo.db(dbName);
        console.log('[TimelineService] MongoDB ready');
      })
      .catch((err) => {
        console.error('[TimelineService] Mongo error:', err);
      });
  }

  // ใช้เรียก collection เดียว
  private col(): Collection<TimelineEvent> | null {
    if (!this.db) return null;
    return this.db.collection<TimelineEvent>('timeline_events');
  }

  /**
   * ดึง timeline ของ trip หนึ่ง ๆ เรียงตามลำดับจุด (stopSeq)
   */
  async getTimelineByTrip(tripId: string): Promise<TimelineEvent[]> {
    const col = this.col();
    if (!col) return [];

    return col
      .find({ tripId })
      .sort({ stopSeq: 1, eta: 1 })
      .toArray();
  }

  /**
   * upsert event ของแต่ละจุด
   * - ใช้คู่ key: tripId + stopSeq (หรือ organizeName) เป็นตัวอ้างอิง
   * - คำนวณ delay + status ให้ในฟังก์ชันนี้เลย
   */
  async upsertTimelineEvent(input: {
    tripId: string;
    stopSeq?: number;
    organizeId?: number;
    organizeName: string;

    eta?: Date | string | null;
    ata?: Date | string | null;
    etd?: Date | string | null;
    atd?: Date | string | null;
  }): Promise<void> {
    const col = this.col();
    if (!col) return;

    const now = new Date();

    const eta = input.eta ? new Date(input.eta) : undefined;
    const ata = input.ata ? new Date(input.ata) : undefined;
    const etd = input.etd ? new Date(input.etd) : undefined;
    const atd = input.atd ? new Date(input.atd) : undefined;

    const { arrivalDelayMin, departureDelayMin, status } =
      this.computeStatus(eta, ata, etd, atd);

    await col.updateOne(
      {
        tripId: input.tripId,
        // เอา stopSeq เป็น key หลัก ถ้าไม่มีจะ fallback ไปใช้ชื่อ organize แทน
        ...(input.stopSeq != null
          ? { stopSeq: input.stopSeq }
          : { organizeName: input.organizeName }),
      },
      {
        $set: {
          tripId: input.tripId,
          stopSeq: input.stopSeq,
          organizeId: input.organizeId,
          organizeName: input.organizeName,
          eta,
          ata,
          etd,
          atd,
          arrivalDelayMin,
          departureDelayMin,
          status,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }

  /**
   * helper คำนวณ delay และสถานะจาก ETA/ATA/ETD/ATD
   */
  private computeStatus(
    eta?: Date,
    ata?: Date,
    etd?: Date,
    atd?: Date,
  ): {
    arrivalDelayMin?: number;
    departureDelayMin?: number;
    status: TimelineStatus;
  } {
    let arrivalDelayMin: number | undefined;
    let departureDelayMin: number | undefined;

    if (eta && ata) {
      arrivalDelayMin = Math.round(
        (ata.getTime() - eta.getTime()) / 60000,
      );
    }

    if (etd && atd) {
      departureDelayMin = Math.round(
        (atd.getTime() - etd.getTime()) / 60000,
      );
    }

    let status: TimelineStatus = 'UNKNOWN';

    // logic ง่าย ๆ เบื้องต้น (ปรับทีหลังได้)
    if (arrivalDelayMin != null && arrivalDelayMin > 0) {
      status = 'DELAY_ARRIVAL';
    } else if (departureDelayMin != null && departureDelayMin > 0) {
      status = 'DELAY_DEPARTURE';
    } else if (
      (arrivalDelayMin === 0 || arrivalDelayMin === undefined) &&
      (departureDelayMin === 0 || departureDelayMin === undefined)
    ) {
      status = 'ON_TIME';
    } else if (
      (arrivalDelayMin != null && arrivalDelayMin < 0) ||
      (departureDelayMin != null && departureDelayMin < 0)
    ) {
      status = 'EARLY';
    }

    return { arrivalDelayMin, departureDelayMin, status };
  }
}
