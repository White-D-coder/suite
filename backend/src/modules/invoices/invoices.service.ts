import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateTemplateDto } from './dto/create-template.dto';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Prisma } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('invoice-generation') private readonly invoiceQueue: Queue,
  ) {}

  async create(createInvoiceDto: CreateInvoiceDto) {
    const { clientId, projectId, invoiceNumber, issueDate, dueDate, currency, taxRate, lineItems } = createInvoiceDto;

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

    // Calculate totals
    let subtotalVal = 0;
    const itemsData = lineItems.map((item) => {
      const itemTotal = item.quantity * item.unitPrice;
      subtotalVal += itemTotal;
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
        total: new Prisma.Decimal(itemTotal),
      };
    });

    const subtotal = new Prisma.Decimal(subtotalVal);
    const taxAmount = new Prisma.Decimal(subtotalVal * (taxRate / 100));
    const total = subtotal.add(taxAmount);

    // Create invoice in 'generating' state
    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        issueDate: new Date(issueDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        currency,
        subtotal,
        taxRate: new Prisma.Decimal(taxRate),
        taxAmount,
        total,
        status: 'generating',
        client: { connect: { id: clientId } },
        project: projectId ? { connect: { id: projectId } } : undefined,
        lineItems: {
          create: itemsData,
        },
      },
      include: {
        lineItems: true,
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
    );

    return {
      invoiceId: invoice.id,
      jobId: job.id,
      status: 'queued',
    };
  }

  async getJobStatus(jobId: string) {
    const job = await this.invoiceQueue.getJob(jobId);
    if (!job) {
      // If job not found in Redis, check DB fallback (completed and saved URL)
      this.loggerWarn(`Job with ID ${jobId} not found in Queue. Checking database.`);
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
      status: state, // active, waiting, delayed
    };
  }

  async findAll() {
    return this.prisma.invoice.findMany({
      include: {
        client: true,
        project: true,
        lineItems: true,
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

  async createTemplate(createTemplateDto: CreateTemplateDto) {
    return this.prisma.invoiceTemplate.create({
      data: createTemplateDto,
    });
  }

  private loggerWarn(msg: string) {
    console.warn(`[InvoicesService] ${msg}`);
  }
}
