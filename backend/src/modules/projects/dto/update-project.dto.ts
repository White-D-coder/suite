import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsString()
  @IsOptional()
  githubRepoUrl?: string;

  @IsString()
  @IsOptional()
  liveUrl?: string;

  @IsString()
  @IsOptional()
  stagingUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  techStack?: string[];

  @IsString()
  @IsOptional()
  hostingPlatform?: string;

  @IsString()
  @IsOptional()
  databasePlatform?: string;

  @IsString()
  @IsOptional()
  deploymentPlatform?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  projectCategory?: string;

  @IsString()
  @IsOptional()
  serviceType?: string;

  @IsString()
  @IsOptional()
  contractStatus?: string;

  @IsString()
  @IsOptional()
  progressStatus?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  system?: string;
}
