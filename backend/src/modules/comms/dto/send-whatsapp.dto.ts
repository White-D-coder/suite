import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SendWhatsappDto {
  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsNotEmpty()
  to: string; // E.164 phone number, e.g. +1234567890

  @IsString()
  @IsNotEmpty()
  content: string;
}
