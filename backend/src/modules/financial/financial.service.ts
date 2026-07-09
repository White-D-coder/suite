import { Injectable, NotFoundException, Logger } from '@nestjs/common';
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

    // Verify client
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    // Auto fetch exchange rate if not explicitly supplied
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
  async createExpense(dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        ...dto,
        amount: new Prisma.Decimal(dto.amount),
        paymentDate: new Date(dto.paymentDate),
      },
    });
  }

  async findAllExpenses() {
    const records = await this.prisma.expense.findMany({
      orderBy: { paymentDate: 'desc' },
    });
    return records.map(r => ({
      ...r,
      amount: Number(r.amount),
    }));
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
    // 1. Total Revenue (Sum of all income in USD: amount * exchangeRate)
    const income = await this.prisma.income.findMany();
    let totalRevenue = 0;
    income.forEach((inc) => {
      const amountUSD = Number(inc.amount) * Number(inc.exchangeRate);
      totalRevenue += amountUSD;
    });

    // 2. Unpaid Invoices (Sum of all invoices not paid)
    const unpaidInvoices = await this.prisma.invoice.findMany({
      where: {
        status: {
          not: 'paid',
        },
      },
    });
    const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);

    // 3. Monthly expenses (Sum of all expenses in current month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const expenses = await this.prisma.expense.findMany({
      where: {
        paymentDate: {
          gte: startOfMonth,
        },
      },
    });
    const totalExpensesMonth = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    // 4. Upcoming renewals in next 30 days
    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);
    const renewals = await this.prisma.subscription.findMany({
      where: {
        renewalDate: {
          gte: new Date(),
          lte: next30Days,
        },
      },
      orderBy: { renewalDate: 'asc' },
    });

    // 5. Chart Trend (Monthly aggregates for last 6 months)
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth();

      const mStart = new Date(year, month, 1);
      const mEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const mIncome = await this.prisma.income.findMany({
        where: {
          paymentDate: {
            gte: mStart,
            lte: mEnd,
          },
        },
      });

      const mExpenses = await this.prisma.expense.findMany({
        where: {
          paymentDate: {
            gte: mStart,
            lte: mEnd,
          },
        },
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

  // Trigger email & WhatsApp reminders for a subscription
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

    const admin = await this.prisma.admin.findFirst();
    const adminEmail = admin?.email || 'admin@agency.com';
    const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || '+15550199';

    this.logger.log(`Dispatching subscription renewal notifications for ${sub.serviceName} to ${adminEmail}`);

    // Send Email
    try {
      await this.commsService.sendEmail({
        to: adminEmail,
        subject,
        content: message,
      });
    } catch (e: any) {
      this.logger.error(`Failed to send email alert: ${e.message}`);
    }

    // Send WhatsApp
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

  // Scan all subscriptions and auto trigger reminders for any that are near their deadline
  async checkAndTriggerAutoReminders() {
    this.logger.log('Starting automated subscription renewal check...');
    const subs = await this.prisma.subscription.findMany();
    const today = new Date();

    let count = 0;
    for (const sub of subs) {
      const daysLeft = Math.ceil((new Date(sub.renewalDate).getTime() - today.getTime()) / 86400000);
      // Trigger reminder if within configured window (e.g. renewalDate - today <= reminderDays)
      if (daysLeft > 0 && daysLeft <= sub.reminderDays) {
        try {
          await this.sendSubscriptionReminder(sub.id);
          count++;
        } catch (e: any) {
          this.logger.error(`Failed to send auto reminder for sub ${sub.id}: ${e.message}`);
        }
      }
    }

    this.logger.log(`Automated subscription check finished. Dispatched ${count} alerts.`);
    return { dispatched: count };
  }
}
