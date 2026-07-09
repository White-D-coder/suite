import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async create(createCredentialDto: CreateCredentialDto) {
    const { password, secretKeys, notes, projectIds, ...rest } = createCredentialDto;

    const encryptedPassword = password ? this.encryptionService.encrypt(password) : null;
    const encryptedSecretKeys = secretKeys ? this.encryptionService.encrypt(secretKeys) : null;
    const encryptedNotes = notes ? this.encryptionService.encrypt(notes) : null;

    return this.prisma.credential.create({
      data: {
        ...rest,
        encryptedPassword,
        encryptedSecretKeys,
        encryptedNotes,
        projects: projectIds && projectIds.length > 0
          ? {
              create: projectIds.map((projectId) => ({
                project: { connect: { id: projectId } },
              })),
            }
          : undefined,
      },
    });
  }

  async findAll(decrypt = false) {
    const credentials = await this.prisma.credential.findMany({
      include: {
        projects: {
          include: {
            project: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return credentials.map((cred) => {
      if (decrypt) {
        return {
          ...cred,
          password: cred.encryptedPassword ? this.encryptionService.decrypt(cred.encryptedPassword) : null,
          secretKeys: cred.encryptedSecretKeys ? this.encryptionService.decrypt(cred.encryptedSecretKeys) : null,
          notes: cred.encryptedNotes ? this.encryptionService.decrypt(cred.encryptedNotes) : null,
        };
      } else {
        // Redact encrypted fields for safety
        const { encryptedPassword, encryptedSecretKeys, encryptedNotes, ...rest } = cred;
        return {
          ...rest,
          password: cred.encryptedPassword ? '••••••••' : null,
          secretKeys: cred.encryptedSecretKeys ? '••••••••' : null,
          notes: cred.encryptedNotes ? '••••••••' : null,
        };
      }
    });
  }

  async findOne(id: string, decrypt = true) {
    const cred = await this.prisma.credential.findUnique({
      where: { id },
      include: {
        projects: {
          include: {
            project: true,
          },
        },
      },
    });
    if (!cred) {
      throw new NotFoundException(`Credential with ID ${id} not found`);
    }

    if (decrypt) {
      return {
        ...cred,
        password: cred.encryptedPassword ? this.encryptionService.decrypt(cred.encryptedPassword) : null,
        secretKeys: cred.encryptedSecretKeys ? this.encryptionService.decrypt(cred.encryptedSecretKeys) : null,
        notes: cred.encryptedNotes ? this.encryptionService.decrypt(cred.encryptedNotes) : null,
      };
    }

    return cred;
  }

  async update(id: string, updateCredentialDto: UpdateCredentialDto) {
    const existing = await this.findOne(id, false);

    const { password, secretKeys, notes, projectIds, ...rest } = updateCredentialDto;

    const data: any = { ...rest };

    if (password !== undefined) {
      data.encryptedPassword = password ? this.encryptionService.encrypt(password) : null;
    }
    if (secretKeys !== undefined) {
      data.encryptedSecretKeys = secretKeys ? this.encryptionService.encrypt(secretKeys) : null;
    }
    if (notes !== undefined) {
      data.encryptedNotes = notes ? this.encryptionService.encrypt(notes) : null;
    }

    // Handle project updates
    if (projectIds !== undefined) {
      // Clear current associations
      await this.prisma.projectCredential.deleteMany({
        where: { credentialId: id },
      });

      if (projectIds.length > 0) {
        data.projects = {
          create: projectIds.map((projectId) => ({
            project: { connect: { id: projectId } },
          })),
        };
      }
    }

    return this.prisma.credential.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id, false);
    return this.prisma.credential.delete({
      where: { id },
    });
  }
}
