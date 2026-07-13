import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { InvoiceProcessor } from './processors/invoice.processor';
import { AuthModule } from '../auth/auth.module';
import { FinancialModule } from '../financial/financial.module';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => FinancialModule),
    BullModule.registerQueue({
      name: 'invoice-generation',
    }),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceProcessor],
  exports: [InvoicesService],
})
export class InvoicesModule {}
