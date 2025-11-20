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

    this.client = connect('mqtt://127.0.0.1:1883'); // เปลี่ยนตาม broker ของคุณ

    this.client.on('connect', () => {
      console.log('[MqttService] MQTT connected');
      this.client.subscribe('warehouse/ble/+/snapshot', (err) => {
        if (err) console.error('[MqttService] Subscribe error:', err);
        else console.log('[MqttService] Subscribed: eye/tags/#');
      });
    });

    this.client.on('message', async (topic, msg) => {
      const text = msg.toString();
      console.log('[MqttService] Message:', topic, text);

      try {
        const json = JSON.parse(text);
        for (const tag of json.tags){
          await this.tagService.saveFromMqtt({
            gw_id: json.gw_id,
            mac: tag.mac,
            rssi: tag.rssi,
            ts: Date.now(),
          });
        }
        
      } catch (err) {
        console.error('[MqttService] Error parsing/saving:', err);
      }
    });
  }
}
