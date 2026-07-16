import { Module, OnModuleInit } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { CredentialsController } from './credentials.controller';
import { TechnologyVaultService } from './technology-vault.service';
import { TechnologyVaultController } from './technology-vault.controller';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [AuthModule, CommonModule],
  controllers: [CredentialsController, TechnologyVaultController],
  providers: [CredentialsService, TechnologyVaultService],
  exports: [CredentialsService, TechnologyVaultService],
})
export class CredentialsModule implements OnModuleInit {
  constructor(private readonly technologyVaultService: TechnologyVaultService) {}

  async onModuleInit() {
    await this.technologyVaultService.seedCatalogue();
  }
}

