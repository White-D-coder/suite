import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { StorageService } from '../../storage/storage.service';
import * as React from 'react';
import ReactPDF from '@react-pdf/renderer';
import { InvoicePDF } from '../components/invoice-pdf.component';

@Processor('invoice-generation')
@Injectable()
export class InvoiceProcessor {
  private readonly logger = new Logger(InvoiceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  @Process('generate-pdf')
  async handlePdfGeneration(job: Job<{ invoiceId: string }>) {
    const { invoiceId } = job.data;
    this.logger.log(`Processing invoice PDF generation for ID: ${invoiceId}`);

    try {
      // Fetch complete invoice data
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: true,
          project: true,
          lineItems: true,
        },
      });

      if (!invoice) {
        throw new Error(`Invoice with ID ${invoiceId} not found in database.`);
      }

      // Fetch company setting
      const company = await this.prisma.companySetting.findFirst();

      // Render PDF using @react-pdf/renderer
      this.logger.log(`Rendering React-PDF template for invoice: ${invoice.invoiceNumber}`);
      const element = React.createElement(InvoicePDF, {
        invoice,
        company,
        client: invoice.client,
      });
      
      const pdfBuffer = await ReactPDF.renderToBuffer(element as any);

      // Generate filename and save using StorageService
      const sanitizedNumber = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `invoice-${sanitizedNumber}-${Date.now()}.pdf`;
      const pdfUrl = await this.storageService.saveFile(fileName, pdfBuffer);

      // Update invoice record in DB
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          pdfUrl,
          status: 'sent', // Auto-transition to sent upon successful generation
        },
      });

      this.logger.log(`Successfully generated and stored PDF for invoice: ${invoice.invoiceNumber}. URL: ${pdfUrl}`);
      return { pdfUrl };
    } catch (error) {
      this.logger.error(`Failed to generate PDF for invoice ID ${invoiceId}: ${(error as Error).message}`);
      throw error; // Rethrow to let BullMQ handle retry limits
    }
  }
}
