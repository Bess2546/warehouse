// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MqttModule } from './mqtt/mqtt.module';
import { TagModule } from './tag/tag.module';


import { TimelineService } from './timeline/timeline.service';
import { TimelineController } from './timeline/timeline.controller';
import { TmsModule } from './tms/tms.module';
import { TrackerModule } from './Tracker/tracker.module';
import { StatsModule } from './stats/stats.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MqttModule,   // Service สำหรับรับ MQTT
    TagModule,    // REST API
    TmsModule,
    TrackerModule,
    StatsModule,
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
