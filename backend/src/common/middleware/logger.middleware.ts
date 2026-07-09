import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const traceId = (req.headers['x-trace-id'] as string) || crypto.randomUUID();
    (req as any).traceId = traceId;
    res.setHeader('X-Trace-Id', traceId);

    const { method, originalUrl, ip } = req;
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      this.logger.log(
        JSON.stringify({
          traceId,
          method,
          url: originalUrl,
          statusCode,
          duration: `${duration}ms`,
          ip,
          userAgent: req.headers['user-agent'] || '',
        }),
      );
    });

    next();
  }
}
