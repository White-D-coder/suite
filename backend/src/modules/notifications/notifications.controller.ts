import { Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../common/services/prisma.service';

@Controller('notifications')
@UseGuards(AdminGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: any, @Query('unread') unread?: string) {
    return this.prisma.notification.findMany({
      where: {
        userId: req.user.userId,
        ...(unread === 'true' ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get('unread-count')
  async unreadCount(@Req() req: any) {
    const count = await this.prisma.notification.count({ where: { userId: req.user.userId, read: false } });
    return { count };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Req() req: any) {
    return this.prisma.notification.updateMany({
      where: { id, userId: req.user.userId },
      data: { read: true, readAt: new Date() },
    });
  }

  @Patch('read-all')
  async markAllRead(@Req() req: any) {
    return this.prisma.notification.updateMany({
      where: { userId: req.user.userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }
}
