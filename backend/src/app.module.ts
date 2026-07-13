import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';

// Global / Core Helpers
import { CommonModule } from './common/common.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

// Functional Submodules
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { CredentialsModule } from './modules/credentials/credentials.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { StorageModule } from './modules/storage/storage.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { FinancialModule } from './modules/financial/financial.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { CommsModule } from './modules/comms/comms.module';
import { HealthModule } from './modules/health/health.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Global Rate Limiter: 100 requests per minute per client IP
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Redis Connection for BullMQ Queue tasks
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),

    // Database & Encryption Global Services
    CommonModule,

    // Storage module (registers global storage providers)
    StorageModule,

    // Main App Modules
    AuthModule,
    ClientsModule,
    ProjectsModule,
    CredentialsModule,
    TasksModule,
    InvoicesModule,
    FinancialModule,
    MonitoringModule,
    CommsModule,
    HealthModule,
    AuditLogsModule,
  ],
  providers: [
    // Activate global throttler rate limiting on all endpoints
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Intercept all routes for request correlation and trace logging
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
