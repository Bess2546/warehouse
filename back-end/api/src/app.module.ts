// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MqttModule } from './mqtt/mqtt.module';
import { TagModule } from './tag/tag.module';
import { TimelineService } from './timeline/timeline.service';
import { TimelineController } from './timeline/timeline.controller';
import { TmsModule } from './tms/tms.module';
import { TrackerModule } from './Tracker/tracker.module';
import { StatsModule } from './stats/stats.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/user.entity';
import { AdminModule } from './admin/admin.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // MongoDB
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/warehouse'),

    //PostgreSQL
    TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get('POSTGRES_HOST', 'localhost'),
    port: configService.get<number>('POSTGRES_PORT', 5432),
    username: configService.get('POSTGRES_USER', 'postgres'),
    password: configService.get('POSTGRES_PASSWORD', 'password'),
    database: configService.get('POSTGRES_DB', 'warehouse_auth'),
    entities: [User],
    synchronize: false,
  }),
  inject: [ConfigService],
}),

    MqttModule,   // Service สำหรับรับ MQTT
    TagModule,    // REST API
    TmsModule,
    TrackerModule,
    StatsModule,
    AuthModule,
    UsersModule,
    AdminModule,
  ],

  controllers: [TimelineController],
  providers: [TimelineService],

})
export class AppModule { }
