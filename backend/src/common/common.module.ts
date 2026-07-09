import { Global, Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { EncryptionService } from './services/encryption.service';

@Global()
@Module({
  providers: [PrismaService, EncryptionService],
  exports: [PrismaService, EncryptionService],
})
export class CommonModule {}
