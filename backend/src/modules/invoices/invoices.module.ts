import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { InvoiceProcessor } from './processors/invoice.processor';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: 'invoice-generation',
    }),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceProcessor],
  exports: [InvoicesService],
})
export class InvoicesModule {}
