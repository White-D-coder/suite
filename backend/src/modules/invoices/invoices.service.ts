import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { randomUUID } from 'crypto';

import { ExchangeRateService } from '../financial/exchange-rate.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exchangeRateService: ExchangeRateService,
    @InjectQueue('invoice-generation') private readonly invoiceQueue: Queue,
  ) {}

  async create(createInvoiceDto: CreateInvoiceDto) {
    const {
      clientId,
      projectId,
      invoiceNumber,
      issueDate,
      dueDate,
      currency,
      taxRate,
      lineItems,
      progressBillingMode,
      taxProfile,
      clientCurrency,
      displayCurrency,
      fxRate,
      fxSource,
      fxMode,
      schedules,
    } = createInvoiceDto;

    // Validate client
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // Verify invoice number uniqueness
    const existing = await this.prisma.invoice.findUnique({
      where: { invoiceNumber },
    });
    if (existing) {
      throw new BadRequestException(`Invoice number ${invoiceNumber} already exists`);
    }

    // 1. Calculate base subtotal
    let subtotalVal = 0;
    const itemsData = lineItems.map((item) => {
      const itemTotal = item.quantity * item.unitPrice;
      subtotalVal += itemTotal;
      return {
        id: randomUUID(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: itemTotal,
      };
    });

    // 2. Apply Tax Profile rules
    let subtotal = subtotalVal;
    let finalTaxRate = taxRate;
    let taxAmount = 0;
    let total = 0;

    const mode = taxProfile || 'exclusive';
    if (mode === 'inclusive') {
      // subtotalVal is the total price including tax
      total = subtotal;
      taxAmount = (total * finalTaxRate) / (finalTaxRate + 100);
      subtotal = total - taxAmount;
    } else if (mode === 'exempt' || mode === 'reverse-charge') {
      finalTaxRate = 0;
      taxAmount = 0;
      total = subtotal;
    } else {
      // standard exclusive
      taxAmount = (subtotal * finalTaxRate) / 100;
      total = subtotal + taxAmount;
    }

    // 3. Multi-currency & FX Freezing logic
    let resolvedFxRate = fxRate;
    let resolvedFxSource = fxSource || 'live';
    const baseCurrency = 'USD'; // Local system standard base
    
    if (currency !== baseCurrency && !resolvedFxRate) {
      resolvedFxRate = await this.exchangeRateService.getExchangeRate(currency, baseCurrency);
      resolvedFxSource = 'ExchangeRateAPI';
    } else if (!resolvedFxRate) {
      resolvedFxRate = 1.0;
    }

    // 4. Milestone/Billing schedules and payments
    let paidAmountVal = 0;
    const scheduleData: any[] = [];

    if (schedules && schedules.length > 0) {
      schedules.forEach((sch) => {
        const isPaid = sch.reminderPolicy === 'paid' || sch.percentage === 0; // Check indicator
        const paidStatus = isPaid ? 'paid' : 'pending';
        const schPaidAmount = isPaid ? sch.amountDue : 0;
        
        paidAmountVal += schPaidAmount;

        scheduleData.push({
          milestoneName: sch.milestoneName,
          percentage: sch.percentage ?? null,
          amountDue: sch.amountDue,
          paymentStatus: paidStatus,
          dueDate: sch.dueDate ? new Date(sch.dueDate) : null,
          paidAmount: schPaidAmount,
          paidAt: isPaid ? new Date() : null,
        });
      });
    }

    const paidAmount = paidAmountVal;
    const remainingBalance = total - paidAmount;

    // 5. Save the Invoices record
    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        issueDate: new Date(issueDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        currency,
        subtotal,
        taxRate: finalTaxRate,
        taxAmount,
        total,
        status: paidAmountVal >= Number(total) ? 'paid' : (paidAmountVal > 0 ? 'partially_paid' : 'sent'),
        client: { connect: { id: clientId } },
        project: projectId ? { connect: { id: projectId } } : undefined,
        lineItems: {
          create: itemsData,
        },
        progressBillingMode: progressBillingMode || 'none',
        paidAmount,
        remainingBalance,
        baseCurrency,
        clientCurrency: clientCurrency || currency,
        displayCurrency: displayCurrency || currency,
        fxRate: resolvedFxRate,
        fxSource: resolvedFxSource,
        fxTimestamp: new Date(),
        fxMode: fxMode || 'frozen',
        taxProfile: mode,
        schedules: scheduleData.length > 0 ? {
          create: scheduleData,
        } : undefined,
      },
      include: {
        lineItems: true,
        schedules: true,
      },
    });

    // Enqueue PDF generation job
    const job = await this.invoiceQueue.add(
      'generate-pdf',
      { invoiceId: invoice.id },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    ).catch(err => {
      console.warn('[InvoicesService] Bull Queue offline, skipping queueing: ', err.message);
      return { id: 'offline-mock' };
    });

    return {
      invoiceId: invoice.id,
      jobId: job.id,
      status: 'success',
    };
  }

  async getJobStatus(jobId: string) {
    try {
      const job = await this.invoiceQueue.getJob(jobId);
      if (!job) {
        return { status: 'unknown', message: 'Job not found in queue registry' };
      }

      const state = await job.getState();
      if (state === 'completed') {
        const result = job.returnvalue;
        return {
          status: 'completed',
          pdfUrl: result?.pdfUrl || null,
        };
      } else if (state === 'failed') {
        return {
          status: 'failed',
          error: job.failedReason,
        };
      }

      return {
        status: state,
      };
    } catch {
      return { status: 'offline', message: 'Bull Queue engine is offline.' };
    }
  }

  async findAll() {
    return this.prisma.invoice.findMany({
      include: {
        client: true,
        project: true,
        lineItems: true,
        schedules: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        project: true,
        lineItems: true,
        schedules: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return invoice;
  }

  // Templates Management
  async getTemplates() {
    return this.prisma.invoiceTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(createTemplateDto: any) {
    return this.prisma.invoiceTemplate.create({
      data: createTemplateDto,
    });
  }
}
