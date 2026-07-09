import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FinancialService } from './financial.service';

@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(private readonly financialService: FinancialService) {}

  // Run a cron scan every day at 9 AM to notify admin of upcoming renewals
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleSubscriptionRenewalScan() {
    this.logger.log('Cron trigger: Scanning subscriptions for upcoming renewals...');
    try {
      const result = await this.financialService.checkAndTriggerAutoReminders();
      this.logger.log(`Cron execution completed. Reminded ${result.dispatched} subscriptions.`);
    } catch (e: any) {
      this.logger.error(`Cron renewal scan failed: ${e.message}`);
    }
  }
}
