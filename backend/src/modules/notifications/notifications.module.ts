import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, CommonModule],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
