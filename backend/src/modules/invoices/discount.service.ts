import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateDiscountDto } from './dto/create-discount.dto';

const DISCOUNT_LIMITS: Record<string, { maxPercent: number; maxFixed: number }> = {
  finance: { maxPercent: 5, maxFixed: 0 },
  admin: { maxPercent: 0, maxFixed: 10000 },
};

@Injectable()
export class DiscountService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pure calculation — no DB write */
  async calculatePreview(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lineItems: true, discounts: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.computeTotals(invoice);
  }

  computeTotals(invoice: any) {
    const subtotal = Number(invoice.subtotal);
    const taxRate = Number(invoice.taxRate);
    const taxProfile = invoice.taxProfile || 'exclusive';
    const calcOrder = invoice.discountCalcOrder || 'before_tax';
    const paidAmount = Number(invoice.paidAmount);

    const discounts = invoice.discounts || [];
    const lineItemDiscountTotal = discounts
      .filter((d: any) => d.discountScope === 'line_item' && d.approvalStatus === 'approved')
      .reduce((acc: number, d: any) => acc + Number(d.calculatedAmount), 0);
    const invoiceDiscountTotal = discounts
      .filter((d: any) => d.discountScope === 'invoice' && d.approvalStatus === 'approved')
      .reduce((acc: number, d: any) => acc + Number(d.calculatedAmount), 0);
    const discountTotal = lineItemDiscountTotal + invoiceDiscountTotal;

    let taxableAmount: number;
    let taxAmount: number;
    let finalPayable: number;

    if (taxProfile === 'inclusive') {
      const preTaxAmount = subtotal - discountTotal;
      taxAmount = preTaxAmount - preTaxAmount / (1 + taxRate / 100);
      taxableAmount = preTaxAmount - taxAmount;
      finalPayable = preTaxAmount;
    } else if (taxProfile === 'exempt') {
      taxableAmount = subtotal - discountTotal;
      taxAmount = 0;
      finalPayable = taxableAmount;
    } else {
      // exclusive
      if (calcOrder === 'before_tax') {
        taxableAmount = subtotal - discountTotal;
        taxAmount = (taxableAmount * taxRate) / 100;
        finalPayable = taxableAmount + taxAmount;
      } else {
        // after_tax
        taxableAmount = subtotal;
        const grossTax = (subtotal * taxRate) / 100;
        taxAmount = grossTax - (discountTotal * taxRate) / 100;
        finalPayable = subtotal + grossTax - discountTotal;
      }
    }

    return {
      subtotal,
      lineItemDiscountTotal,
      invoiceDiscountTotal,
      discountTotal,
      taxableAmount: Math.max(0, taxableAmount),
      taxRate,
      taxAmount: Math.max(0, taxAmount),
      finalPayableAmount: Math.max(0, finalPayable),
      paidAmount,
      outstandingBalance: Math.max(0, finalPayable - paidAmount),
    };
  }

  async create(invoiceId: string, dto: CreateDiscountDto, requesterId: string, requesterRole: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lineItems: true, discounts: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const subtotal = Number(invoice.subtotal);

    // Calculate amount
    let calculatedAmount: number;
    if (dto.discountType === 'percentage') {
      const base = dto.discountScope === 'invoice' ? subtotal : this.getLineItemTotal(invoice.lineItems, dto.invoiceItemId);
      calculatedAmount = (base * dto.discountValue) / 100;
    } else {
      calculatedAmount = dto.discountValue;
    }

    // Check approval thresholds
    let approvalStatus = 'approved';
    const limits = DISCOUNT_LIMITS[requesterRole];
    if (limits) {
      if (dto.discountType === 'percentage' && dto.discountValue > limits.maxPercent) {
        approvalStatus = 'pending';
      } else if (dto.discountType === 'fixed' && dto.discountValue > limits.maxFixed) {
        approvalStatus = 'pending';
      }
    }

    const discount = await this.prisma.invoiceDiscount.create({
      data: {
        invoiceId,
        invoiceItemId: dto.invoiceItemId,
        discountType: dto.discountType,
        discountScope: dto.discountScope,
        discountValue: dto.discountValue,
        calculatedAmount,
        purposeCode: dto.purposeCode,
        purposeNote: dto.purposeNote,
        requestedById: requesterId,
        approvalStatus,
      },
    });

    // Recompute and persist invoice totals
    await this.recomputeInvoiceTotals(invoiceId, approvalStatus === 'pending' ? 'pending' : null);

    return { discount, approvalStatus };
  }

  async approve(discountId: string, approverId: string, invoiceId: string) {
    const discount = await this.prisma.invoiceDiscount.findUnique({ where: { id: discountId } });
    if (!discount || discount.invoiceId !== invoiceId) throw new NotFoundException('Discount not found');

    const updated = await this.prisma.invoiceDiscount.update({
      where: { id: discountId },
      data: { approvalStatus: 'approved', approvedById: approverId, approvedAt: new Date() },
    });
    await this.recomputeInvoiceTotals(invoiceId, null);
    return updated;
  }

  async reject(discountId: string, invoiceId: string) {
    const discount = await this.prisma.invoiceDiscount.findUnique({ where: { id: discountId } });
    if (!discount || discount.invoiceId !== invoiceId) throw new NotFoundException('Discount not found');

    const updated = await this.prisma.invoiceDiscount.update({
      where: { id: discountId },
      data: { approvalStatus: 'rejected' },
    });
    await this.recomputeInvoiceTotals(invoiceId, null);
    return updated;
  }

  async delete(discountId: string, invoiceId: string) {
    await this.prisma.invoiceDiscount.delete({ where: { id: discountId } });
    await this.recomputeInvoiceTotals(invoiceId, null);
    return { message: 'Discount removed' };
  }

  private getLineItemTotal(lineItems: any[], itemId?: string): number {
    if (!itemId) return 0;
    const item = lineItems.find((li) => li.id === itemId);
    return item ? Number(item.total) : 0;
  }

  private async recomputeInvoiceTotals(invoiceId: string, discountStatus: string | null) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lineItems: true, discounts: true },
    });
    if (!invoice) return;

    const totals = this.computeTotals(invoice);
    const hasPending = invoice.discounts.some((d: any) => d.approvalStatus === 'pending');

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        discountTotal: totals.discountTotal,
        taxableAmount: totals.taxableAmount,
        finalPayableAmount: totals.finalPayableAmount,
        taxAmount: totals.taxAmount,
        total: totals.finalPayableAmount,
        remainingBalance: totals.outstandingBalance,
        discountStatus: hasPending ? 'pending' : null,
      },
    });
  }
}
