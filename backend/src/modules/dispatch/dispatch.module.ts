import { Module } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { PrismaService } from '../../common/services/prisma.service';

@Module({
  controllers: [DispatchController],
  providers: [DispatchService, PrismaService],
  exports: [DispatchService],
})
export class DispatchModule {}
