// src/mqtt/mqtt.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';
import { TagService } from '../tag/tag.service';

@Injectable()
export class MqttService implements OnModuleInit {
  private client: MqttClient;

  constructor(private readonly tagService: TagService) {
    console.log('[MqttService] created');
  }

  onModuleInit() {
    console.log('[MqttService] Connecting to MQTT...');

    // ถ้า Mosquitto อยู่เครื่องอื่น เปลี่ยน IP ตรงนี้
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
          console.warn('[MqttService] json.tags is not array:', json);
          return;
        }

        // แปลงเป็นรูปที่ TagService ต้องการ
        const tags = json.tags.map((t: any) => ({
          mac: t.mac,
          rssi: t.rssi,
          ts: Date.now(),
        }));

        // ใช้ snapshot ฟังก์ชันแทนการ save ทีละ tag
        await this.tagService.updateGatewaySnapshot(json.gw_id, tags);
      } catch (err) {
        console.error('[MqttService] Error parsing/saving:', err);
      }
    });
  }
}
