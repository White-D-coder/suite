import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('audit-logs')
@UseGuards(AdminGuard, RolesGuard)
@Roles('owner', 'admin')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  async findAll(@Req() req: any) {
    return this.auditLogsService.findAll(req.user);
  }
}
