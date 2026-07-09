import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsDateString, IsInt } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  provider: string;

  @IsString()
  @IsNotEmpty()
  serviceName: string;

  @IsNumber()
  @Min(0)
  cost: number;

  @IsString()
  @IsNotEmpty()
  billingCycle: string; // monthly, yearly

  @IsDateString()
  @IsNotEmpty()
  renewalDate: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsInt()
  @IsOptional()
  reminderDays?: number;
}
