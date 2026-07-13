import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('finance')
@UseGuards(AdminGuard, RolesGuard)
@Roles('owner', 'admin', 'finance')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Get('dashboard')
  async getDashboardData() {
    return this.financialService.getDashboardData();
  }

  // Income
  @Get('income')
  async getIncome() {
    return this.financialService.findAllIncome();
  }

  @Post('income')
  async recordIncome(@Body() createIncomeDto: CreateIncomeDto) {
    return this.financialService.createIncome(createIncomeDto);
  }

  // Expenses CRUD
  @Get('expenses')
  async getExpenses() {
    return this.financialService.findAllExpenses();
  }

  @Post('expenses')
  async recordExpense(@Body() createExpenseDto: CreateExpenseDto) {
    return this.financialService.createExpense(createExpenseDto);
  }

  @Put('expenses/:id')
  async updateExpense(@Param('id') id: string, @Body() body: any) {
    return this.financialService.updateExpense(id, body);
  }

  @Delete('expenses/:id')
  async removeExpense(@Param('id') id: string) {
    return this.financialService.removeExpense(id);
  }

  @Post('expenses/:id/postpone')
  async postponeExpense(@Param('id') id: string, @Body() body: any) {
    return this.financialService.postponeExpense(id, body);
  }

  // Subscriptions
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

  // Salaries CRUD
  @Get('salaries')
  async getSalaries() {
    return this.financialService.findAllSalaries();
  }

  @Post('salaries')
  async recordSalary(@Body() body: any) {
    return this.financialService.createSalary(body);
  }

  @Put('salaries/:id')
  async updateSalary(@Param('id') id: string, @Body() body: any) {
    return this.financialService.updateSalary(id, body);
  }

  @Delete('salaries/:id')
  async removeSalary(@Param('id') id: string) {
    return this.financialService.removeSalary(id);
  }

  // Analyzers
  @Get('analysers/financial')
  async getFinancialAnalyser() {
    return this.financialService.getFinancialAnalyser();
  }

  @Get('analysers/profitability')
  async getProjectProfitability() {
    return this.financialService.getProjectProfitability();
  }
}
