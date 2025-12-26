// src/mqtt/mqtt.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';
import { TagService } from '../tag/tag.service';
import { TagScanBufferService } from '../tag-movement/tag-scan-buffer.service';
import { WarehouseService } from '../warehouse/warehouse.service';  
import { TrackerService } from '../Tracker/tracker.service';           
import { macToTagUid } from '../common/source-type';

@Injectable()
export class MqttService implements OnModuleInit {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient;

  constructor(
    private readonly tagService: TagService,
    private readonly trackerService: TrackerService,        
    private readonly scanBufferService: TagScanBufferService,
    private readonly warehousesService: WarehouseService,  
  ) {
    this.logger.log('MqttService created');
  }

  onModuleInit() {
    this.logger.log('Connecting to MQTT...');

    this.client = connect(process.env.MQTT_URL || 'mqtt://127.0.0.1:1883');

    this.client.on('connect', () => {
      this.logger.log('MQTT connected');
      this.client.subscribe('warehouse/ble/+/snapshot', (err) => {
        if (err) this.logger.error('Subscribe error:', err);
        else this.logger.log('Subscribed: warehouse/ble/+/snapshot');
      });
    });

    this.client.on('message', async (topic, msg) => {
      const text = msg.toString();
      this.logger.debug(`Message: ${topic} ${text}`);

      try {
        const json = JSON.parse(text);

        if (!Array.isArray(json.tags)) {
          this.logger.warn('Invalid snapshot payload:', json);
          return;
        }

        const eventIso = new Date().toISOString();
        const imei = json.IMEI_ID || json.imei || json.gw_id || null;
        
        // ดึง Organization จาก PostgreSQL
        const org = imei ? await this.trackerService.getOrganizeByM5(imei) : null;

        if (org) {
          this.logger.log(`From IMEI ${imei} → Org: ${org.id} - ${org.name}`);
        } else {
          this.logger.warn(`No org found for IMEI=${imei}`);
        }

        const orgId = org?.id ?? 0;

        // แปลง tags เป็นรูปแบบมาตรฐาน
        const processedTags = json.tags.map((t: any) => ({
          TagUid: macToTagUid(t.mac),
          Rssi: t.rssi,
          BatteryVoltageMv: null,
          raw: t.raw ?? null,
        }));

        // 1. บันทึกลง TagLastSeenProcessed (MongoDB)
        const unifiedPayload = {
          SourceType: 'M5',
          SourceId: imei,
          OrgId: orgId,
          EventTime: eventIso,
          Tags: processedTags,
        };
        await this.tagService.handleGatewaySnapshot(unifiedPayload);

        // 2. ประมวลผล IN/OUT ด้วย debounce logic
        await this.processMovementsWithBuffer(orgId, imei, processedTags);

      } catch (err) {
        this.logger.error('Error parsing/saving:', err);
      }
    });
  }

  /**
   * ประมวลผล IN/OUT ด้วย TagScanBufferService
   */
  private async processMovementsWithBuffer(
    orgId: number,
    m5DeviceId: string,
    tags: Array<{ TagUid: string; Rssi: number }>,
  ) {
    try {
      // 1. หา warehouse ที่ M5 นี้ติดตั้งอยู่ (จาก PostgreSQL)
      const warehouse = await this.warehousesService.getWarehouseByM5(m5DeviceId);

      if (!warehouse) {
        this.logger.debug(`No warehouse for M5: ${m5DeviceId}`);
        return;
      }

      // PostgreSQL fields: id, name (ตัวเล็ก)
      const warehouseId = warehouse.id.toString();
      const warehouseName = warehouse.name;

      this.logger.debug(`Processing ${tags.length} tags at ${warehouseName}`);

      // 2. ส่งให้ ScanBufferService ประมวลผล
      await this.scanBufferService.processScanSnapshot(
        orgId,
        warehouseId,
        warehouseName,
        m5DeviceId,
        'M5',
        tags,
      );

    } catch (err) {
      this.logger.error(`Error processing movements: ${err.message}`);
    }
  }
}