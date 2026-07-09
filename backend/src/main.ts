import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  // Setup Winston structured logger
  const loggerInstance = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    ],
  });

  const app = await NestFactory.create(AppModule, {
    logger: loggerInstance,
  });

  // Enable graceful shutdown hooks (for BullMQ workers and DB closing)
  app.enableShutdownHooks();

  // Set global endpoint prefix
  app.setGlobalPrefix('api');

  // Serve uploads folder statically for local storage provider
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Configure CORS using FRONTEND_URL environment variable (supports comma-separated list)
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const origins = frontendUrl.split(',').map(o => o.trim());
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Trace-Id',
  });

  // Global validation pipe for strict DTO checking
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter to return unified JSON error objects
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  loggerInstance.log(`Application is running on: http://localhost:${port}/api`);
}
bootstrap();
