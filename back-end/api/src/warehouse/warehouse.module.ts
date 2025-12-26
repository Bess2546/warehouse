// src/warehouse/warehouse.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WarehouseEntity } from "../warehouse/warehouse.entity";
import { TrackerEntity } from "../Tracker/entities/tracker.entity";
import { WarehouseController } from "../warehouse/warehouse.controller";
import { WarehouseService } from "../warehouse/warehouse.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([WarehouseEntity, TrackerEntity]),
    ],
    controllers: [WarehouseController],
    providers: [WarehouseService],
    exports: [WarehouseService],
})

export class WarehouseModule {}