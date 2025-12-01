// src/mqtt/mqtt.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';
import { TagService } from '../tag/tag.service';
import { macToTagUid } from 'src/common/source-type';

@Injectable()
export class MqttService implements OnModuleInit {
  private client: MqttClient;

  constructor(private readonly tagService: TagService) {
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

        // --------- Convert old snapshot format -> unified format -----------
        // json = { gw_id, time, tags:[ {mac, rssi, raw} ] }

        if (!Array.isArray(json.tags)) {
          console.warn('[MqttService] Invalid snapshot payload:', json);
          return;
        }

        const eventTime =
          typeof json.time === 'number'
            ? new Date(json.time * 1000)
            : new Date();

        const unifiedPayload = {
          SourceType: 'M5',
          SourceId: json.gw_id,
          OrgId: 0,
          EventTime: json.time ? json.time * 1000 : Date.now(),
          Tags: json.tags.map((t: any) => ({
            TagUid: macToTagUid(t.mac),
            Rssi: t.rssi,
            BatteryVoltageMv: null,   // ให้ backend decode แทน
            raw: t.raw ?? null,
          })),
        };

        // --------- Save using new system -----------
        await this.tagService.handleGatewaySnapshot(unifiedPayload);
      } catch (err) {
        console.error('[MqttService] Error parsing/saving:', err);
      }
    });
  }
}
