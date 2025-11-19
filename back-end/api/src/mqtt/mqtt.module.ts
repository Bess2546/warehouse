// src/mqtt/mqtt.module.ts
import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';

@Module({
  providers: [MqttService],
})
export class MqttModule {}
