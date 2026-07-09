import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, IsOptional } from 'class-validator';

class TriggerCheckDto {
  @IsString()
  @IsOptional()
  projectId?: string;
}

@Controller('monitoring')
@UseGuards(AdminGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Post('trigger')
  async triggerCheck(@Body() body: TriggerCheckDto) {
    if (body.projectId) {
      const result = await this.monitoringService.checkProjectMonitor(body.projectId);
      return { success: true, result };
    } else {
      await this.monitoringService.checkAllMonitors();
      return { success: true, message: 'All monitors triggered successfully.' };
    }
  }
}
