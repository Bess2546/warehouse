// src/tms/tms.service.ts
import { Injectable, Logger } from '@nestjs/common';

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
  private readonly baseUrl = process.env.TMS_BASE_URL || 'http://tms.example.com';

  async getOrganizeByM5(imei: string): Promise<TmsOrganize | null> {
    if (!imei) return null;

    const url = `${this.baseUrl}/api/Tracker/GetOrganizeByM5?imei=${encodeURIComponent(
      imei,
    )}`;

    this.logger.log(`Call TMS GetOrganizeByM5 imei=${imei}`);

    const res = await fetch(url);           // Node 18+ มี fetch ในตัว
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
  }
}
