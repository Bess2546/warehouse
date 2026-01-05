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
  private isReady = false;

  constructor(
    private readonly tagService: TagService,
    private readonly trackerService: TrackerService,        
    private readonly scanBufferService: TagScanBufferService,
    private readonly warehousesService: WarehouseService,  
  ) {
    this.logger.log('MqttService created');
  }

  onModuleInit() {
    this.logger.log('Waiting for services to be ready...');

    // รอ 5 วินาทีให้ MongoDB connections พร้อม
    setTimeout(() => {
      this.logger.log('Connecting to MQTT...');
      this.connectMqtt();
    }, 10000);
  }

  private connectMqtt() {
    this.client = connect(process.env.MQTT_URL || 'mqtt://127.0.0.1:1883');

    this.client.on('connect', () => {
      this.logger.log('MQTT connected');
      this.client.subscribe('warehouse/ble/+/snapshot', (err) => {
        if (err) this.logger.error('Subscribe error:', err);
        else {
          this.logger.log('Subscribed: warehouse/ble/+/snapshot');
          this.isReady = true;
        }
      });
    });

    this.client.on('message', async (topic, msg) => {
      if (!this.isReady) {
        this.logger.debug('Not ready yet, skipping message');
        return;
      }
      
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
        
        const org = imei ? await this.trackerService.getOrganizeByM5(imei) : null;

        if (org) {
          this.logger.log(`From IMEI ${imei} → Org: ${org.id} - ${org.name}`);
        } else {
          this.logger.warn(`No org found for IMEI=${imei}`);
        }

        const orgId = org?.id ?? 0;

        const processedTags = json.tags.map((t: any) => ({
          TagUid: macToTagUid(t.mac),
          Rssi: t.rssi,
          BatteryVoltageMv: null,
          raw: t.raw ?? null,
        }));

        const unifiedPayload = {
          SourceType: 'M5',
          SourceId: imei,
          OrgId: orgId,
          EventTime: eventIso,
          Tags: processedTags,
        };
        await this.tagService.handleGatewaySnapshot(unifiedPayload);

        await this.processMovementsWithBuffer(orgId, imei, processedTags);

      } catch (err) {
        this.logger.error('Error parsing/saving:', err);
      }
    });
  }

  private async processMovementsWithBuffer(
    orgId: number,
    m5DeviceId: string,
    tags: Array<{ TagUid: string; Rssi: number }>,
  ) {
    try {
      const warehouse = await this.warehousesService.getWarehouseByM5(m5DeviceId);

      if (!warehouse) {
        this.logger.debug(`No warehouse for M5: ${m5DeviceId}`);
        return;
      }

      const warehouseId = warehouse.id.toString();
      const warehouseName = warehouse.name;

      this.logger.debug(`Processing ${tags.length} tags at ${warehouseName}`);

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
