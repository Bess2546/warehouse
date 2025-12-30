// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
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
import { Organization } from './organizations/entities/organization.entity';
import { TagMovementModule } from './tag-movement/tag-movement.module';
import { TrackerEntity } from './Tracker/entities/tracker.entity';
import { WarehouseEntity } from './warehouse/warehouse.entity';
import { RefreshToken } from ".//auth/entities/refresh-token.entity";

import { LoggerMiddleware, RateLimitMiddleware } from './common/middleware';
import { WarehouseModule } from './warehouse/warehouse.module';

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
        entities: [User, Organization,TrackerEntity,WarehouseEntity, RefreshToken],
        synchronize: false,
        ssl: {
          rejectUnauthorized: false,
        }
      }),
      inject: [ConfigService],
    }),

    MqttModule,
    TagModule,
    TmsModule,
    TrackerModule,
    StatsModule,
    AuthModule,
    UsersModule,
    AdminModule,
    TagMovementModule,
    WarehouseModule,
  ],

  controllers: [TimelineController],
  providers: [TimelineService],
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Logger - ทุก routes
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL});

    // Rate Limit - เฉพาะ routes สำคัญ
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes(
        { path: 'auth/login', method: RequestMethod.ALL},
        { path: 'admin/*', method: RequestMethod.ALL}
      );
  }
}