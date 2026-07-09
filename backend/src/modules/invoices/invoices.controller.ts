import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';

@Controller('invoices')
@UseGuards(AdminGuard)
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
