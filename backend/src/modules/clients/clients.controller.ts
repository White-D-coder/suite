import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('clients')
@UseGuards(AdminGuard, RolesGuard)
@Roles('owner', 'admin', 'finance')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  async create(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }

  @Get()
  async findAll() {
    return this.clientsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }

  // Client Contacts sub-endpoints
  @Post(':id/contacts')
  async addContact(@Param('id') clientId: string, @Body() body: any) {
    return this.clientsService.addContact(clientId, body);
  }

  @Delete('contacts/:contactId')
  async removeContact(@Param('contactId') contactId: string) {
    return this.clientsService.removeContact(contactId);
  }

  // Contact Channels sub-endpoints
  @Post('contacts/:contactId/channels')
  async addChannel(@Param('contactId') contactId: string, @Body() body: any) {
    return this.clientsService.addChannel(contactId, body);
  }

  @Delete('contacts/channels/:channelId')
  async removeChannel(@Param('channelId') channelId: string) {
    return this.clientsService.removeChannel(channelId);
  }
}
