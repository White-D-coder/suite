import { IsString, IsNumber, IsOptional, IsIn, Min } from 'class-validator';

export class CreateDiscountDto {
  @IsIn(['percentage', 'fixed'])
  discountType: string;

  @IsIn(['invoice', 'line_item'])
  discountScope: string;

  @IsNumber()
  @Min(0)
  discountValue: number;

  @IsOptional()
  @IsString()
  invoiceItemId?: string;

  @IsString()
  purposeCode: string;

  @IsOptional()
  @IsString()
  purposeNote?: string;
}
