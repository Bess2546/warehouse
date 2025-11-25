// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MqttModule } from './mqtt/mqtt.module';
import { TagModule } from './tag/tag.module';
// import { Users } from 'lucide-react';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MqttModule,   // Service สำหรับรับ MQTT
    TagModule,    // REST API
    // AuthModule,
    // UsersModule,
  ],
})
export class AppModule {}
