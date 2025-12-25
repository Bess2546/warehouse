// src/warehouse/warehouse.module.ts
import { Module } from "@nestjs/common";
import { WarehouseController } from "../warehouse/warehouse.controller";
import { WarehouseService } from "../warehouse/warehouse.service";

@Module({
    controllers: [WarehouseController],
    providers: [WarehouseService],
    exports: [WarehouseService],
})

export class WarehouseModule {}