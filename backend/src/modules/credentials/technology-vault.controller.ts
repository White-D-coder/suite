import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { TechnologyVaultService } from './technology-vault.service';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(AdminGuard)
export class TechnologyVaultController {
  constructor(private readonly svc: TechnologyVaultService) {}

  // ── Catalogue ──────────────────────────────────────────
  @Get('technologies')
  listCatalogue(@Query('search') search?: string) {
    return this.svc.listCatalogue(search);
  }

  @Post('technologies')
  createCatalogue(@Body() dto: any) {
    return this.svc.createCatalogue(dto);
  }

  @Get('technologies/:id')
  getCatalogue(@Param('id') id: string) {
    return this.svc.getCatalogue(id);
  }

  @Post('technologies/:id/accounts')
  createAccount(@Param('id') technologyId: string, @Body() dto: any) {
    return this.svc.createAccount(technologyId, dto);
  }

  // ── Accounts ───────────────────────────────────────────
  @Get('technology-accounts')
  listAccounts(@Query() filters: any) {
    return this.svc.listAccounts(filters);
  }

  @Get('technology-accounts/:id')
  getAccount(@Param('id') id: string) {
    return this.svc.getAccount(id);
  }

  @Patch('technology-accounts/:id')
  updateAccount(@Param('id') id: string, @Body() dto: any) {
    return this.svc.updateAccount(id, dto);
  }

  @Delete('technology-accounts/:id')
  deleteAccount(@Param('id') id: string) {
    return this.svc.deleteAccount(id);
  }

  // ── Environments ───────────────────────────────────────
  @Post('technology-accounts/:id/environments')
  createEnvironment(@Param('id') id: string, @Body() dto: any) {
    return this.svc.createEnvironment(id, dto);
  }

  // ── Fields ─────────────────────────────────────────────
  @Post('technology-accounts/:id/fields')
  createField(@Param('id') id: string, @Body() dto: any) {
    return this.svc.createField(id, dto);
  }

  @Patch('technology-account-fields/:fieldId')
  updateField(@Param('fieldId') fieldId: string, @Body() dto: any) {
    return this.svc.updateField(fieldId, dto);
  }

  @Post('vault/fields/:fieldId/reveal')
  revealField(@Param('fieldId') fieldId: string, @Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers['user-agent'];
    return this.svc.revealField(fieldId, req.user.userId, req.user.role, ip, ua);
  }

  // ── Project Linking ────────────────────────────────────
  @Post('projects/:projectId/technologies')
  linkToProject(@Param('projectId') projectId: string, @Body() dto: { technologyAccountId: string; connectionType?: string }) {
    return this.svc.linkToProject(projectId, dto.technologyAccountId, dto.connectionType);
  }

  @Delete('projects/:projectId/technologies/:accountId')
  unlinkFromProject(@Param('projectId') projectId: string, @Param('accountId') accountId: string) {
    return this.svc.unlinkFromProject(projectId, accountId);
  }

  @Get('vault/project/:projectId')
  getProjectTechnologies(@Param('projectId') projectId: string) {
    return this.svc.getProjectTechnologies(projectId);
  }

  // ── Vault Search ───────────────────────────────────────
  @Get('vault/search')
  vaultSearch(@Query('q') q: string, @Query() filters: any) {
    return this.svc.vaultSearch(q || '', filters);
  }

  @Get('vault/technology/:technologyId')
  getTechnologyAccounts(@Param('technologyId') technologyId: string, @Query() filters: any) {
    return this.svc.listAccounts({ ...filters, technologyId });
  }

  // ── Field Access Requests ──────────────────────────────
  @Post('vault/field-access-requests')
  createAccessRequest(@Body() dto: any, @Req() req: any) {
    return this.svc.createAccessRequest({ ...dto, requesterId: req.user.userId });
  }

  @Get('vault/field-access-requests')
  listAccessRequests(@Query() filters: any) {
    return this.svc.listAccessRequests(filters);
  }

  @Get('vault/field-access-requests/:id')
  getAccessRequest(@Param('id') id: string) {
    return this.svc.listAccessRequests({});
  }

  @Post('vault/field-access-requests/:id/approve')
  approveRequest(@Param('id') id: string, @Body() dto: { approvals: any[]; durationMin?: number }, @Req() req: any) {
    return this.svc.approveAccessRequest(id, req.user.userId, dto.approvals, dto.durationMin);
  }

  @Post('vault/field-access-requests/:id/reject')
  rejectRequest(@Param('id') id: string, @Body() dto: { reason: string }) {
    return this.svc.rejectAccessRequest(id, dto.reason);
  }

  @Post('vault/field-access-requests/:id/revoke')
  revokeRequest(@Param('id') id: string) {
    return this.svc.revokeGrant(id);
  }

  // ── Employee Access ────────────────────────────────────
  @Get('employees/:employeeId/credential-access')
  getEmployeeAccess(@Param('employeeId') employeeId: string) {
    return this.svc.getEmployeeCredentialAccess(employeeId);
  }

  @Delete('employee-credential-grants/:grantId')
  revokeGrant(@Param('grantId') grantId: string) {
    return this.svc.revokeGrant(grantId);
  }

  // ── Subscriptions ──────────────────────────────────────
  @Get('subscriptions/expiring')
  getExpiringSubscriptions(@Query('days') days?: string) {
    return this.svc.getExpiringSubscriptions(days ? parseInt(days) : 30);
  }
}
