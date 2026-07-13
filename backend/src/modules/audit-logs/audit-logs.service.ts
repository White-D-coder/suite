import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: any) {
    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new ForbiddenException('Only Owners and Admins can view audit logs.');
    }

    return this.prisma.auditLog.findMany({
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
