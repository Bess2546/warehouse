// src/mqtt/mqtt.module.ts
import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { TagModule } from '../tag/tag.module';
import { TmsModule } from 'src/tms/tms.module';

@Module({
  imports: [TagModule, TmsModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
