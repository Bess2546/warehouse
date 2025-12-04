// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MqttModule } from './mqtt/mqtt.module';
import { TagModule } from './tag/tag.module';


import { TimelineService } from './timeline/timeline.service';
import { TimelineController } from './timeline/timeline.controller';
import { TmsModule } from './tms/tms.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MqttModule,   // Service สำหรับรับ MQTT
    TagModule,    // REST API
    TmsModule,
    // AuthModule,
    // UsersModule,
  ],

  controllers:[
    TimelineController, //
  ],

  providers:[
    TimelineService, //
  ],
})
export class AppModule {}
