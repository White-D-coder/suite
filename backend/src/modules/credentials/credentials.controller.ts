import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';

@Controller('credentials')
@UseGuards(AdminGuard)
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Post()
  async create(@Body() createCredentialDto: CreateCredentialDto) {
    return this.credentialsService.create(createCredentialDto);
  }

  @Get()
  async findAll(@Query('decrypt') decrypt?: string) {
    const shouldDecrypt = decrypt === 'true';
    return this.credentialsService.findAll(shouldDecrypt);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.credentialsService.findOne(id, true);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateCredentialDto: UpdateCredentialDto) {
    return this.credentialsService.update(id, updateCredentialDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.credentialsService.remove(id);
  }
}
