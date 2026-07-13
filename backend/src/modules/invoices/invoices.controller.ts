import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('invoices')
@UseGuards(AdminGuard, RolesGuard)
@Roles('owner', 'admin', 'finance')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('generate')
  async generate(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Get('job/:jobId')
  async checkJobStatus(@Param('jobId') jobId: string) {
    return this.invoicesService.getJobStatus(jobId);
  }

  @Get()
  async findAll() {
    return this.invoicesService.findAll();
  }

  @Get('templates')
  async getTemplates() {
    return this.invoicesService.getTemplates();
  }

  @Post('templates')
  async createTemplate(@Body() createTemplateDto: CreateTemplateDto) {
    return this.invoicesService.createTemplate(createTemplateDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }
}
