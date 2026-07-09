import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck } from '@nestjs/terminus';
import { PrismaService } from '../../common/services/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as fs from 'fs';
import * as path from 'path';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    @InjectQueue('invoice-generation') private readonly invoiceQueue: Queue,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([
      // Database connection audit
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' } };
        } catch (err) {
          return { database: { status: 'down', error: (err as Error).message } };
        }
      },
      // Redis server ping audit
      async () => {
        try {
          const client = (this.invoiceQueue.client as any);
          if (client && typeof client.ping === 'function') {
            await client.ping();
            return { redis: { status: 'up' } };
          }
          // Fallback check
          return { redis: { status: 'up', detail: 'Queue registered successfully' } };
        } catch (err) {
          return { redis: { status: 'down', error: (err as Error).message } };
        }
      },
      // Write access checks on local storage directory
      async () => {
        try {
          const uploadPath = path.resolve(process.cwd(), 'uploads');
          fs.accessSync(uploadPath, fs.constants.W_OK);
          return {
            storage: {
              status: 'up',
              provider: process.env.STORAGE_PROVIDER || 'local',
            },
          };
        } catch (err) {
          return { storage: { status: 'down', error: (err as Error).message } };
        }
      },
    ]);
  }
}
