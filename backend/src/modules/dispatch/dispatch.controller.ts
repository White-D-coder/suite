import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(AdminGuard)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Post('projects/:projectId/dispatch')
  create(@Param('projectId') projectId: string, @Body() dto: any, @Req() req: any) {
    return this.dispatchService.create(projectId, dto, req.user.userId);
  }

  @Get('projects/:projectId/dispatch')
  list(@Param('projectId') projectId: string, @Query() filters: any) {
    return this.dispatchService.list(projectId, filters);
  }

  @Get('dispatch/search')
  search(@Query('q') q: string, @Query() filters: any) {
    return this.dispatchService.search(q || '', filters);
  }

  @Get('dispatch/:id')
  getOne(@Param('id') id: string) {
    return this.dispatchService.getOne(id);
  }

  @Patch('dispatch/:id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.dispatchService.update(id, dto);
  }

  @Delete('dispatch/:id')
  delete(@Param('id') id: string) {
    return this.dispatchService.delete(id);
  }

  @Post('dispatch/:id/generate-summary')
  generateSummary(@Param('id') id: string) {
    return this.dispatchService.generateSummary(id);
  }

  @Post('dispatch/:id/verify-summary')
  verifySummary(@Param('id') id: string, @Body() body: { editedSummary?: string }, @Req() req: any) {
    return this.dispatchService.verifySummary(id, req.user.userId, body.editedSummary);
  }

  @Post('dispatch/:id/regenerate-summary')
  regenerateSummary(@Param('id') id: string) {
    return this.dispatchService.generateSummary(id);
  }

  @Post('dispatch/:id/create-task')
  createTask(@Param('id') id: string, @Body() body: { actionItemId: string }) {
    return this.dispatchService.createTaskFromAction(id, body.actionItemId);
  }

  @Post('dispatch/:id/create-invoice-milestone')
  createMilestone(@Param('id') id: string, @Body() body: any) {
    return this.dispatchService.createMilestoneFromAction(id, body);
  }
}
