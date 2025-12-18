// src/tms/tms.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Shipment } from '../schemas/shipment.schema';
import { MongoClient } from 'mongodb';

interface TmsOrganize {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  note?: string;
}

@Injectable()
export class TmsService {
  private readonly logger = new Logger(TmsService.name);
  // สำหรับโหมด real (TMS จริง)
  private readonly baseUrl = process.env.TMS_BASE_URL || 'http://tms.example.com';
  private db: any;

  constructor(
    @InjectModel(Shipment.name) private shipmentModel: Model<Shipment>,
  ) {
    const mongoUrl = process.env.MONGO_URI || 'mongodb://localhost:27017';
    const dbName = 'warehouse';

    const client = new MongoClient(mongoUrl);
    client.connect().then(() => {
      this.db = client.db(dbName);
      this.logger.log('[TmsService] MongoDB ready (for mock TMS)');
    });
  }

  async findAllShipments(status?: string) {
    const filter = status ? { status } : {};
    return this.shipmentModel.find(filter).exec();
  }

  async findShipmentById(id: string) {
    return this.shipmentModel.findById(id).exec();
  }

  async createShipment(data: any) {
    const shipment = new this.shipmentModel(data);
    return shipment.save();
  }

  async updateShipment(id: string, data: any) {
    return this.shipmentModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async getShipmentTimeline(id: string) {
    const shipment = await this.shipmentModel.findById(id).exec();
    if (!shipment) return null;
    return shipment.route || [];
  }


  async getOrganizeByM5(imei: string): Promise<TmsOrganize | null> {
    if (!imei) return null;

    const mode = process.env.TMS_MODE || 'mock'; // 'mock' | 'real' | 'hybrid'

    if (mode === 'real') {
      // ใช้ TMS จริง
      return this.getFromHttp(imei);
    }

    if (mode === 'hybrid') {
      // ลองยิง TMS จริงก่อน ถ้า error ค่อย fallback มา DB ของเรา
      const fromHttp = await this.getFromHttp(imei);
      if (fromHttp) return fromHttp;
      return this.getFromDb(imei);
    }

    // default = mock (ใช้ DB ของเราเอง)
    return this.getFromDb(imei);
  }

  // === ดึงจาก TMS จริงผ่าน HTTP ===
  private async getFromHttp(imei: string): Promise<TmsOrganize | null> {
    const url = `${this.baseUrl}/api/Tracker/GetOrganizeByM5?imei=${encodeURIComponent(
      imei,
    )}`;

    this.logger.log(`Call REAL TMS: ${url}`);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.error(`TMS error ${res.status} ${res.statusText}`);
        return null;
      }

      const body = await res.json();

      if (!body?.data) {
        this.logger.warn(`TMS response without data: ${JSON.stringify(body)}`);
        return null;
      }

      const d = body.data;
      return {
        id: d.id,
        name: d.name,
        address: d.address,
        phone: d.phone,
        note: d.note,
      };
    } catch (e) {
      this.logger.error(`TMS fetch error: ${e}`);
      return null;
    }
  }

  // === ดึงจาก MongoDB organizes (mock/local) ===
  private async getFromDb(imei: string): Promise<TmsOrganize | null> {
    if (!this.db) {
      this.logger.error('MongoDB not ready in TmsService');
      return null;
    }

    this.logger.log(`Lookup IMEI=${imei} in organizes (LOCAL DB)`);

    const doc = await this.db.collection('organizes').findOne({ imei });

    if (!doc) {
      this.logger.warn(`IMEI=${imei} not found in organizes`);
      return null;
    }

    return {
      id: doc.id,
      name: doc.name,
      address: doc.address,
      phone: doc.phone,
      note: doc.note,
    };
  }
}
