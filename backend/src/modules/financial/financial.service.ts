import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ExchangeRateService } from './exchange-rate.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { Prisma } from '@prisma/client';
import { CommsService } from '../comms/comms.service';

@Injectable()
export class FinancialService {
  private readonly logger = new Logger(FinancialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly commsService: CommsService,
  ) {}

  // Income Methods
  async createIncome(dto: CreateIncomeDto) {
    const { clientId, projectId, invoiceId, amount, currency, paymentDate, status } = dto;

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    let rate = dto.exchangeRate;
    if (rate === undefined) {
      rate = await this.exchangeRateService.getExchangeRate(currency, 'USD');
    }

    return this.prisma.income.create({
      data: {
        clientId,
        projectId,
        invoiceId,
        amount: new Prisma.Decimal(amount),
        currency,
        exchangeRate: new Prisma.Decimal(rate),
        paymentDate: new Date(paymentDate),
        status,
      },
    });
  }

  async findAllIncome() {
    const records = await this.prisma.income.findMany({
      include: { client: true, project: true },
      orderBy: { paymentDate: 'desc' },
    });
    return records.map(r => ({
      ...r,
      amount: Number(r.amount),
      exchangeRate: Number(r.exchangeRate),
    }));
  }

  // Expense Methods
  async createExpense(dto: CreateExpenseDto & { recurrence?: string; vendor?: string; projectId?: string; status?: string; dueDate?: string; reminderDays?: number; taxAmount?: number; taxProfile?: string; receiptAttachment?: string }) {
    const { recurrence, vendor, projectId, status, dueDate, reminderDays, taxAmount, taxProfile, receiptAttachment, ...rest } = dto;
    return this.prisma.expense.create({
      data: {
        ...rest,
        amount: new Prisma.Decimal(rest.amount),
        paymentDate: new Date(rest.paymentDate),
        recurrence: recurrence || 'one-off',
        vendor,
        projectId,
        status: status || 'paid',
        dueDate: dueDate ? new Date(dueDate) : null,
        reminderDays: reminderDays ?? 7,
        taxAmount: taxAmount ? new Prisma.Decimal(taxAmount) : null,
        taxProfile,
        receiptAttachment,
      },
    });
  }

  async findAllExpenses() {
    const records = await this.prisma.expense.findMany({
      include: { project: true },
      orderBy: { paymentDate: 'desc' },
    });
    return records.map(r => ({
      ...r,
      amount: Number(r.amount),
      taxAmount: r.taxAmount ? Number(r.taxAmount) : null,
    }));
  }

  async updateExpense(id: string, data: any) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Expense not found');

    const updateData: any = { ...data };
    if (data.amount !== undefined) updateData.amount = new Prisma.Decimal(data.amount);
    if (data.paymentDate !== undefined) updateData.paymentDate = new Date(data.paymentDate);
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount ? new Prisma.Decimal(data.taxAmount) : null;
    if (data.postponedUntil !== undefined) updateData.postponedUntil = data.postponedUntil ? new Date(data.postponedUntil) : null;

    // Log edit to Audit trail
    await this.prisma.auditLog.create({
      data: {
        action: 'financial_edit',
        details: JSON.stringify({ action: 'update_expense', id, changes: Object.keys(data) }),
      },
    });

    return this.prisma.expense.update({
      where: { id },
      data: updateData,
    });
  }

  async removeExpense(id: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Expense not found');

    await this.prisma.auditLog.create({
      data: {
        action: 'deletion',
        details: JSON.stringify({ action: 'delete_expense', id, amount: existing.amount }),
      },
    });

    return this.prisma.expense.delete({ where: { id } });
  }

  async postponeExpense(id: string, data: any) {
    return this.updateExpense(id, {
      status: 'postponed',
      postponedUntil: data.postponedUntil,
      postponeReason: data.postponeReason,
    });
  }

  // Salary Methods
  async createSalary(data: any) {
    const gross = Number(data.grossAmount);
    const deductions = Number(data.deductions || 0);
    const tax = Number(data.taxAmount || 0);
    const benefits = Number(data.benefits || 0);
    const net = gross - deductions - tax + benefits;

    return this.prisma.salaryRecord.create({
      data: {
        employeeId: data.employeeId,
        employmentType: data.employmentType || 'employee',
        grossAmount: new Prisma.Decimal(gross),
        deductions: new Prisma.Decimal(deductions),
        taxAmount: new Prisma.Decimal(tax),
        benefits: new Prisma.Decimal(benefits),
        netAmount: new Prisma.Decimal(net),
        dueDate: new Date(data.dueDate),
        payPeriod: data.payPeriod || '2026-07',
        status: data.status || 'pending',
      },
    });
  }

  async findAllSalaries() {
    const records = await this.prisma.salaryRecord.findMany({
      include: { employee: true },
      orderBy: { dueDate: 'desc' },
    });
    return records.map(r => ({
      ...r,
      grossAmount: Number(r.grossAmount),
      deductions: Number(r.deductions),
      taxAmount: Number(r.taxAmount),
      benefits: Number(r.benefits),
      netAmount: Number(r.netAmount),
    }));
  }

  async updateSalary(id: string, data: any) {
    const existing = await this.prisma.salaryRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Salary record not found');

    const updateData: any = { ...data };
    let gross = Number(data.grossAmount ?? existing.grossAmount);
    let deductions = Number(data.deductions ?? existing.deductions);
    let tax = Number(data.taxAmount ?? existing.taxAmount);
    let benefits = Number(data.benefits ?? existing.benefits);

    if (data.grossAmount !== undefined) updateData.grossAmount = new Prisma.Decimal(gross);
    if (data.deductions !== undefined) updateData.deductions = new Prisma.Decimal(deductions);
    if (data.taxAmount !== undefined) updateData.taxAmount = new Prisma.Decimal(tax);
    if (data.benefits !== undefined) updateData.benefits = new Prisma.Decimal(benefits);
    
    // Recalculate net
    updateData.netAmount = new Prisma.Decimal(gross - deductions - tax + benefits);

    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.paidDate !== undefined) updateData.paidDate = data.paidDate ? new Date(data.paidDate) : null;

    // Log edit to Audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'financial_edit',
        details: JSON.stringify({ action: 'update_salary', id, employeeId: existing.employeeId }),
      },
    });

    return this.prisma.salaryRecord.update({
      where: { id },
      data: updateData,
    });
  }

  async removeSalary(id: string) {
    const existing = await this.prisma.salaryRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Salary record not found');

    await this.prisma.auditLog.create({
      data: {
        action: 'deletion',
        details: JSON.stringify({ action: 'delete_salary', id, employeeId: existing.employeeId }),
      },
    });

    return this.prisma.salaryRecord.delete({ where: { id } });
  }

  // Subscription Methods
  async createSubscription(dto: CreateSubscriptionDto) {
    return this.prisma.subscription.create({
      data: {
        ...dto,
        cost: new Prisma.Decimal(dto.cost),
        renewalDate: new Date(dto.renewalDate),
      },
    });
  }

  async findAllSubscriptions() {
    const records = await this.prisma.subscription.findMany({
      orderBy: { renewalDate: 'asc' },
    });
    return records.map(r => ({
      ...r,
      cost: Number(r.cost),
    }));
  }

  // Dashboard Aggregator
  async getDashboardData() {
    const income = await this.prisma.income.findMany();
    let totalRevenue = 0;
    income.forEach((inc) => {
      totalRevenue += Number(inc.amount) * Number(inc.exchangeRate);
    });

    const unpaidInvoices = await this.prisma.invoice.findMany({
      where: { status: { not: 'paid' } },
    });
    const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.remainingBalance || inv.total), 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const expenses = await this.prisma.expense.findMany({
      where: { paymentDate: { gte: startOfMonth } },
    });
    const totalExpensesMonth = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);
    const renewals = await this.prisma.subscription.findMany({
      where: {
        renewalDate: { gte: new Date(), lte: next30Days },
      },
      orderBy: { renewalDate: 'asc' },
    });

    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth();

      const mStart = new Date(year, month, 1);
      const mEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const mIncome = await this.prisma.income.findMany({
        where: { paymentDate: { gte: mStart, lte: mEnd } },
      });

      const mExpenses = await this.prisma.expense.findMany({
        where: { paymentDate: { gte: mStart, lte: mEnd } },
      });

      const revenueUSD = mIncome.reduce((sum, inc) => sum + (Number(inc.amount) * Number(inc.exchangeRate)), 0);
      const expenseUSD = mExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      const monthName = d.toLocaleString('default', { month: 'short' });
      chartData.push({
        month: monthName,
        revenue: Math.round(revenueUSD),
        expenses: Math.round(expenseUSD),
        profit: Math.round(revenueUSD - expenseUSD),
      });
    }

    return {
      totalRevenue: Math.round(totalRevenue),
      totalUnpaid: Math.round(totalUnpaid),
      monthlyExpenses: Math.round(totalExpensesMonth),
      upcomingRenewals: renewals.map(r => ({
        ...r,
        cost: Number(r.cost),
      })),
      revenueTrend: chartData,
    };
  }

  // 1. Business Financial Analyser (Profit & Loss, Inactive Subscriptions)
  async getFinancialAnalyser() {
    // A. Profit and Loss summary
    const incomes = await this.prisma.income.findMany();
    const expenses = await this.prisma.expense.findMany();
    const salaries = await this.prisma.salaryRecord.findMany({ where: { status: 'paid' } });

    const totalIncome = incomes.reduce((sum, inc) => sum + Number(inc.amount) * Number(inc.exchangeRate), 0);
    const totalExpense = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const totalSalary = salaries.reduce((sum, sal) => sum + Number(sal.netAmount), 0);

    const netProfit = totalIncome - totalExpense - totalSalary;

    // B. Unused subscription sniffer (subscriptions not mapped to project tool subscriptions)
    const activeToolSubs = await this.prisma.projectToolSubscription.findMany();
    const activeToolVendors = new Set(activeToolSubs.map(t => t.vendor.toLowerCase()));

    const globalSubs = await this.prisma.subscription.findMany();
    const wastefulSubscriptions = globalSubs.filter(sub => {
      // If serviceName or provider is NOT referenced in active tool subs, we count it as wasteful/unused
      return !activeToolVendors.has(sub.provider.toLowerCase()) && !activeToolVendors.has(sub.serviceName.toLowerCase());
    }).map(r => ({
      ...r,
      cost: Number(r.cost),
    }));

    return {
      summary: {
        totalIncome,
        totalExpense,
        totalSalary,
        netProfit,
      },
      wastefulSubscriptions,
    };
  }

  // 2. Project Profitability Analyser (Apportion labor costs & tools margin)
  async getProjectProfitability() {
    const projects = await this.prisma.project.findMany({
      include: {
        invoices: { where: { status: 'paid' } },
        assignments: {
          include: {
            employee: {
              include: { salaries: true },
            },
          },
        },
        tools: true,
        expenses: true,
      },
    });

    const activeProjectCount = projects.filter(p => p.status === 'active').length || 1;

    // Load global subscriptions cost to apportion equally (indirect overhead)
    const globalSubs = await this.prisma.subscription.findMany();
    const totalIndirectOverhead = globalSubs.reduce((sum, sub) => sum + Number(sub.cost), 0);
    const indirectPerProject = totalIndirectOverhead / activeProjectCount;

    return projects.map((project) => {
      // 1. Revenue
      const revenue = project.invoices.reduce((sum, inv) => sum + Number(inv.total), 0);

      // 2. Direct Labor Cost (proportion of assigned staff payroll)
      let laborCost = 0;
      project.assignments.forEach((assign) => {
        // Apportion based on their latest salary
        const baseSalary = assign.employee.salaries[0]?.netAmount || 3000; // default rate fallback
        laborCost += Number(baseSalary) * 0.5; // Apportion 50% allocation per project by default
      });

      // 3. Tool Cost
      const toolsCost = project.tools.reduce((sum, t) => sum + Number(t.cost), 0);

      // 4. Project-linked Expenses
      const directExpenses = project.expenses.reduce((sum, e) => sum + Number(e.amount), 0);

      // 5. Total cost and margin
      const totalDirectCost = laborCost + toolsCost + directExpenses;
      const profit = revenue - totalDirectCost - indirectPerProject;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      let status = 'healthy';
      if (margin < 0) {
        status = 'loss-making';
      } else if (margin < 30) {
        status = 'borderline';
      }

      return {
        projectId: project.id,
        projectName: project.name,
        revenue,
        directCost: totalDirectCost,
        indirectCost: indirectPerProject,
        profit,
        margin: Math.round(margin * 100) / 100,
        status,
      };
    });
  }

  // Trigger reminders (WhatsApp/SMS mock alerts)
  async sendSubscriptionReminder(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub) {
      throw new NotFoundException(`Subscription with ID ${subscriptionId} not found`);
    }

    const daysLeft = Math.ceil((new Date(sub.renewalDate).getTime() - Date.now()) / 86400000);
    const cost = Number(sub.cost);
    const dateStr = new Date(sub.renewalDate).toLocaleDateString();

    const subject = `⚠️ Subscription Renewal Due: ${sub.serviceName}`;
    const message = `Hello Admin,\n\nYour subscription for ${sub.serviceName} from ${sub.provider} is renewing on ${dateStr} (${daysLeft} days remaining).\n\nCost: $${cost.toFixed(2)}\nBilling Cycle: ${sub.billingCycle}\nPayment Method: ${sub.paymentMethod || 'N/A'}\n\nPlease check your billing accounts.\n\nBest,\nCommand Center`;

    const admin = await this.prisma.user.findFirst({
      where: { role: { in: ['admin', 'owner'] } },
    });
    const adminEmail = admin?.email || 'admin@agency.com';
    const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || '+15550199';

    try {
      await this.commsService.sendEmail({
        to: adminEmail,
        subject,
        content: message,
      });
    } catch (e: any) {
      this.logger.error(`Failed to send email alert: ${e.message}`);
    }

    try {
      await this.commsService.sendWhatsapp({
        to: adminPhone,
        content: `[RENEWAL ALERT] ${sub.serviceName} from ${sub.provider} is renewing in ${daysLeft} days on ${dateStr}. Cost: $${cost.toFixed(2)}.`,
      });
    } catch (e: any) {
      this.logger.error(`Failed to send WhatsApp alert: ${e.message}`);
    }

    return { success: true };
  }

  async checkAndTriggerAutoReminders() {
    const subs = await this.prisma.subscription.findMany();
    const today = new Date();

    let count = 0;
    for (const sub of subs) {
      const daysLeft = Math.ceil((new Date(sub.renewalDate).getTime() - today.getTime()) / 86400000);
      if (daysLeft > 0 && daysLeft <= sub.reminderDays) {
        try {
          await this.sendSubscriptionReminder(sub.id);
          count++;
        } catch (e: any) {
          this.logger.error(`Failed to send auto reminder for sub ${sub.id}: ${e.message}`);
        }
      }
    }
    return { dispatched: count };
  }
}
