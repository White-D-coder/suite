import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';

@Controller('finance')
@UseGuards(AdminGuard)
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Get('dashboard')
  async getDashboardData() {
    return this.financialService.getDashboardData();
  }

  @Get('income')
  async getIncome() {
    return this.financialService.findAllIncome();
  }

  @Post('income')
  async recordIncome(@Body() createIncomeDto: CreateIncomeDto) {
    return this.financialService.createIncome(createIncomeDto);
  }

  @Get('expenses')
  async getExpenses() {
    return this.financialService.findAllExpenses();
  }

  @Post('expenses')
  async recordExpense(@Body() createExpenseDto: CreateExpenseDto) {
    return this.financialService.createExpense(createExpenseDto);
  }

  @Get('subscriptions')
  async getSubscriptions() {
    return this.financialService.findAllSubscriptions();
  }

  @Post('subscriptions')
  async recordSubscription(@Body() createSubscriptionDto: CreateSubscriptionDto) {
    return this.financialService.createSubscription(createSubscriptionDto);
  }

  @Post('subscriptions/:id/remind')
  async triggerReminder(@Param('id') id: string) {
    return this.financialService.sendSubscriptionReminder(id);
  }
}
