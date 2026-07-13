import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, Ip, Headers } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';

@Controller('credentials')
@UseGuards(AdminGuard)
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  // Collections CRUD
  @Post('collections')
  async createCollection(@Body() body: any) {
    return this.credentialsService.createCollection(body);
  }

  @Get('collections')
  async findAllCollections(@Req() req: any) {
    return this.credentialsService.findAllCollections(req.user);
  }

  @Get('collections/:id')
  async findOneCollection(@Param('id') id: string, @Req() req: any) {
    return this.credentialsService.findOneCollection(id, req.user);
  }

  // Secrets CRUD
  @Post('collections/:id/secrets')
  async addSecret(@Param('id') collectionId: string, @Body() body: any, @Req() req: any) {
    return this.credentialsService.addSecret(collectionId, body, req.user);
  }

  @Delete('secrets/:secretId')
  async removeSecret(@Param('secretId') secretId: string, @Req() req: any) {
    return this.credentialsService.removeSecret(secretId, req.user);
  }

  // Plaintext reveal (Audited & Re-authenticated)
  @Post('secrets/:secretId/reveal')
  async revealSecret(
    @Param('secretId') secretId: string,
    @Body() body: any,
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.credentialsService.revealSecret(secretId, body, req.user, ipAddress, userAgent);
  }

  // Access Requests
  @Post('requests')
  async createRequest(@Body() body: any, @Req() req: any) {
    return this.credentialsService.createRequest(body, req.user);
  }

  @Get('requests')
  async findAllRequests(@Req() req: any) {
    return this.credentialsService.findAllRequests(req.user);
  }

  @Post('requests/:id/approve')
  async approveRequest(@Param('id') id: string, @Req() req: any) {
    return this.credentialsService.approveRequest(id, req.user);
  }

  @Post('requests/:id/reject')
  async rejectRequest(@Param('id') id: string, @Req() req: any) {
    return this.credentialsService.rejectRequest(id, req.user);
  }

  @Post('requests/:id/revoke')
  async revokeRequest(@Param('id') id: string, @Req() req: any) {
    return this.credentialsService.revokeRequest(id, req.user);
  }

  // Rotation Tasks (Pending Rotation Queue)
  @Get('rotation-queue')
  async getRotationQueue(@Req() req: any) {
    return this.credentialsService.getRotationQueue(req.user);
  }

  @Post('rotation-tasks/:id/complete')
  async completeRotation(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.credentialsService.completeRotation(id, body, req.user);
  }

  @Post('rotation-tasks/:id/snooze')
  async snoozeRotation(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.credentialsService.snoozeRotation(id, body, req.user);
  }
}
