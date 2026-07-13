import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, ValidateNested, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class LineItemDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class InvoiceScheduleDto {
  @IsString()
  @IsNotEmpty()
  milestoneName: string;

  @IsNumber()
  @IsOptional()
  percentage?: number;

  @IsNumber()
  @IsNotEmpty()
  amountDue: number;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsOptional()
  reminderPolicy?: string;
}

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsNotEmpty()
  invoiceNumber: string;

  @IsDateString()
  @IsNotEmpty()
  issueDate: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsNumber()
  @Min(0)
  taxRate: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemDto)
  lineItems: LineItemDto[];

  // New multi-currency, progress billing, and tax configurations
  @IsString()
  @IsOptional()
  progressBillingMode?: string;

  @IsString()
  @IsOptional()
  taxProfile?: string;

  @IsString()
  @IsOptional()
  clientCurrency?: string;

  @IsString()
  @IsOptional()
  displayCurrency?: string;

  @IsNumber()
  @IsOptional()
  fxRate?: number;

  @IsString()
  @IsOptional()
  fxSource?: string;

  @IsString()
  @IsOptional()
  fxMode?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InvoiceScheduleDto)
  schedules?: InvoiceScheduleDto[];
}
