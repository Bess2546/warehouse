// src/common/middleware/rate-limit.middleware.ts

import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  firstRequest: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private requests = new Map<string, RateLimitRecord>();
  
  // ตั้งค่า Rate Limit
  private readonly windowMs = 60 * 1000; // 1 นาที
  private readonly maxRequests = 100;     // 100 requests ต่อนาที

  use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // ดึงข้อมูล request ของ IP นี้
    const record = this.requests.get(ip);

    if (!record) {
      // IP ใหม่
      this.requests.set(ip, { count: 1, firstRequest: now });
      return next();
    }

    // เช็คว่าผ่านไป 1 นาทีหรือยัง
    if (now - record.firstRequest > this.windowMs) {
      // Reset counter
      this.requests.set(ip, { count: 1, firstRequest: now });
      return next();
    }

    // เพิ่ม counter
    record.count++;

    // เช็คว่าเกิน limit ไหม
    if (record.count > this.maxRequests) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((record.firstRequest + this.windowMs - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // เพิ่ม headers แสดงสถานะ rate limit
    res.setHeader('X-RateLimit-Limit', this.maxRequests);
    res.setHeader('X-RateLimit-Remaining', this.maxRequests - record.count);
    res.setHeader('X-RateLimit-Reset', new Date(record.firstRequest + this.windowMs).toISOString());

    next();
  }
}
