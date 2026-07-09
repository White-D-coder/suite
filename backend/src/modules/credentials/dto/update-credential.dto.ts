import { IsString, IsOptional, IsEmail, IsArray } from 'class-validator';

export class UpdateCredentialDto {
  @IsString()
  @IsOptional()
  platformName?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  secretKeys?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEmail()
  @IsOptional()
  recoveryEmail?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  projectIds?: string[];
}
