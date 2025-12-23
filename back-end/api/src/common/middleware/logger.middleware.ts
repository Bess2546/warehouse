// src/common/middleware/logger.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const start = Date.now();

    // ดึง user จาก JWT (ถ้ามี)
    const user = (req as any).user;
    const userId = user?.userId || 'anonymous';
    const username = user?.username || 'anonymous';

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;
      const contentLength = res.get('content-length') || 0;

      // กำหนดสีตาม status code
      let logMethod: 'log' | 'warn' | 'error' = 'log';
      if (statusCode >= 400 && statusCode < 500) logMethod = 'warn';
      if (statusCode >= 500) logMethod = 'error';

      this.logger[logMethod](
        `${method} ${originalUrl} ${statusCode} - ${duration}ms - ${contentLength}bytes - User: ${username}(${userId}) - IP: ${ip}`
      );
    });

    next();
  }
}
