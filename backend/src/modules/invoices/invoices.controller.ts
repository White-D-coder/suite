import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { DiscountService } from './discount.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('invoices')
@UseGuards(AdminGuard, RolesGuard)
@Roles('owner', 'admin', 'finance')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly discountService: DiscountService,
  ) {}

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

  // ── Discount Management ────────────────────────────────

  @Get(':invoiceId/calculation-preview')
  async calculationPreview(@Param('invoiceId') invoiceId: string) {
    return this.discountService.calculatePreview(invoiceId);
  }

  @Post(':invoiceId/discounts')
  async createDiscount(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreateDiscountDto,
    @Req() req: any,
  ) {
    return this.discountService.create(invoiceId, dto, req.user.userId, req.user.role);
  }

  @Post(':invoiceId/discounts/:discountId/approve')
  @Roles('owner')
  async approveDiscount(
    @Param('invoiceId') invoiceId: string,
    @Param('discountId') discountId: string,
    @Req() req: any,
  ) {
    return this.discountService.approve(discountId, req.user.userId, invoiceId);
  }

  @Post(':invoiceId/discounts/:discountId/reject')
  @Roles('owner', 'admin')
  async rejectDiscount(
    @Param('invoiceId') invoiceId: string,
    @Param('discountId') discountId: string,
  ) {
    return this.discountService.reject(discountId, invoiceId);
  }

  @Delete(':invoiceId/discounts/:discountId')
  async deleteDiscount(
    @Param('invoiceId') invoiceId: string,
    @Param('discountId') discountId: string,
  ) {
    return this.discountService.delete(discountId, invoiceId);
  }
}

