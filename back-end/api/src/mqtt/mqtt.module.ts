// src/mqtt/mqtt.module.ts
import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { TagModule } from '../tag/tag.module';

@Module({
  imports: [TagModule],
  providers: [MqttService],
})
export class MqttModule {}
