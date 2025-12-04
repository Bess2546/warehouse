// src/tms/tms.module.ts
import { Module } from '@nestjs/common';
import { TmsService } from './tms.service';

@Module({
  providers: [TmsService],
  exports: [TmsService],   // ให้ service ตัวอื่นเอาไปใช้ได้
})
export class TmsModule {}
