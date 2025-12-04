// src/mqtt/mqtt.service.ts
import { Injectable, OnModuleInit,Logger } from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';
import { TagService } from '../tag/tag.service';
import { macToTagUid } from '../common/source-type'; 
import { TmsService } from 'src/tms/tms.service';

@Injectable()
export class MqttService implements OnModuleInit {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient;

  constructor(
    private readonly tagService: TagService,
    private readonly tmsService: TmsService,
  ){
    console.log('[MqttService] created');
  }

  onModuleInit() {
    console.log('[MqttService] Connecting to MQTT...');

    this.client = connect('mqtt://127.0.0.1:1883');

    this.client.on('connect', () => {
      console.log('[MqttService] MQTT connected');
      this.client.subscribe('warehouse/ble/+/snapshot', (err) => {
        if (err) console.error('[MqttService] Subscribe error:', err);
        else console.log('[MqttService] Subscribed: warehouse/ble/+/snapshot');
      });
    });

    this.client.on('message', async (topic, msg) => {
      const text = msg.toString();
      console.log('[MqttService] Message:', topic, text);

      try {
        const json = JSON.parse(text);

        if (!Array.isArray(json.tags)) {
          console.warn('[MqttService] Invalid snapshot payload:', json);
          return;
        }

        const eventIso = new Date().toDateString();
        const imei = json.IMEI_ID || json.imei || json.gw_id || null;
        const org = imei ? await this.tmsService.getOrganizeByM5(imei):null;

             if (org) {
          this.logger.log(
            `From IMEI ${imei} → Organize: ${org.id} - ${org.name}`,
          );
        } else {
          this.logger.warn(`No organize found for IMEI=${imei}`);
        }

        const unifiedPayload = {
          SourceType: 'M5',
          SourceId: imei,
          OrgId: org?.id ?? 0,
          EventTime: eventIso,
          Tags: json.tags.map((t: any) => ({
            TagUid: macToTagUid(t.mac),
            Rssi: t.rssi,
            BatteryVoltageMv: null,
            raw: t.raw ?? null,
          })),
        };

        await this.tagService.handleGatewaySnapshot(unifiedPayload);
      } catch (err) {
        console.error('[MqttService] Error parsing/saving:', err);
      }
    });
  }
}
