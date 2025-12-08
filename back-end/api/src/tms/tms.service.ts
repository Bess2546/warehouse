//src/tms/tms.service.ts
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
  }
}




// // src/tms/tms.service.ts (MOCK_UP)
// import { Injectable, Logger } from '@nestjs/common';

// interface TmsOrganize {
//   id: number;
//   name: string;
//   address?: string;
//   phone?: string;
//   note?: string;
// }

// @Injectable()
// export class TmsService {
//   private readonly logger = new Logger(TmsService.name);

//   // Mock database: ใส่ IMEI ของ M5 แต่ละตัวให้ตรงความจริง
//   private readonly mockMap: Record<string, TmsOrganize> = {
//     "19001900199": {
//       id: 10,
//       name: "BKK Hub",
//       address: "Rama9 Thailand",
//       phone: "0123456789",
//       note: "Mocked data",
//     },
//     "19001900999": {
//       id: 20,
//       name: "Laos Border",
//       address: "Vientiane",
//       phone: "9876543210",
//       note: "Mocked data 2",
//     }
//   };

//   async getOrganizeByM5(imei: string): Promise<TmsOrganize | null> {
//     this.logger.log(`Mock TMS Lookup: IMEI=${imei}`);

//     const org = this.mockMap[imei];

//     if (!org) {
//       this.logger.warn(`IMEI=${imei} not found in mock database`);
//       return null;
//     }

//     return org;
//   }
// }

