import { Module } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { FinancialController } from './financial.controller';
import { ExchangeRateService } from './exchange-rate.service';
import { AuthModule } from '../auth/auth.module';
import { CommsModule } from '../comms/comms.module';
import { RemindersScheduler } from './reminders.scheduler';

@Module({
  imports: [AuthModule, CommsModule],
  controllers: [FinancialController],
  providers: [FinancialService, ExchangeRateService, RemindersScheduler],
  exports: [FinancialService, ExchangeRateService],
})
export class FinancialModule {}
