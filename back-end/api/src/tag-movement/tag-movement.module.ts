// src/tag-movement/tag-movement.module.ts

import { Module } from "@nestjs/common";
import { TagMovementController } from "../tag-movement/tag-movement.controller";
import { TagMovementService } from "../tag-movement/tag-movement.service";
import { TagScanBufferService } from "./tag-scan-buffer.service";
import { TagScanBufferController } from "./tag-scan-buffer.controller";

@Module({
    controllers: [
        TagMovementController,
        TagScanBufferController,
    ],
    providers: [
        TagMovementService,
        TagScanBufferService
    ],
    exports: [
        TagMovementService,
        TagScanBufferService,
    ],
})

export class TagMovementModule {}