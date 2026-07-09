import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    TerminusModule,
    // Register the queue to inject it into the health controller for connection monitoring
    BullModule.registerQueue({
      name: 'invoice-generation',
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
