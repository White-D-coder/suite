import { Injectable, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  // 1. Vault Collections
  async createCollection(data: any) {
    return this.prisma.vaultCollection.create({
      data: {
        projectId: data.projectId,
        provider: data.provider,
        rotationPolicy: data.rotationPolicy || 'every 90 days',
        lastRotationDate: new Date(),
      },
    });
  }

  async findAllCollections(user: any) {
    const where: any = {};
    if (user.role === 'employee') {
      where.project = {
        assignments: {
          some: { employeeId: user.id },
        },
      };
    }

    const collections = await this.prisma.vaultCollection.findMany({
      where,
      include: {
        project: true,
        secrets: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Redact secret values by default in the list
    return collections.map((col) => ({
      ...col,
      secrets: col.secrets.map((sec) => {
        const { encryptedValue, ...rest } = sec;
        return {
          ...rest,
          encryptedValue: '••••••••',
        };
      }),
    }));
  }

  async findOneCollection(id: string, user: any) {
    const col = await this.prisma.vaultCollection.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            assignments: true,
          },
        },
        secrets: true,
      },
    });

    if (!col) {
      throw new NotFoundException(`Vault collection not found`);
    }

    if (user.role === 'employee') {
      const isAssigned = col.project.assignments.some((a) => a.employeeId === user.id);
      if (!isAssigned) {
        throw new ForbiddenException('Access denied. You are not assigned to this project.');
      }
    }

    // Redact secret values by default
    return {
      ...col,
      secrets: col.secrets.map((sec) => {
        const { encryptedValue, ...rest } = sec;
        return {
          ...rest,
          encryptedValue: '••••••••',
        };
      }),
    };
  }

  // 2. Vault Secrets CRUD
  async addSecret(collectionId: string, data: any, user: any) {
    const col = await this.prisma.vaultCollection.findUnique({
      where: { id: collectionId },
      include: { project: true },
    });
    if (!col) throw new NotFoundException(`Collection not found`);

    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new ForbiddenException('Only Owners and Admins can create vault secrets.');
    }

    const plaintext = data.password || data.secretValue;
    if (!plaintext) {
      throw new Error('Secret value or password is required.');
    }

    const encryptedValue = this.encryptionService.encrypt(plaintext);

    const secret = await this.prisma.vaultSecret.create({
      data: {
        collectionId,
        secretType: data.secretType || 'password',
        username: data.username,
        encryptedValue,
        tool: data.tool,
        environment: data.environment || 'development',
        owner: data.owner || 'Owner',
        revealPolicy: data.revealPolicy || 'owner_admin_approved',
      },
    });

    // Create initial version
    await this.prisma.vaultSecretVersion.create({
      data: {
        secretId: secret.id,
        version: 1,
        encryptedValue,
      },
    });

    // Log addition to audit trail
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'financial_edit', // categorized as data edits
        details: JSON.stringify({
          action: 'add_secret',
          secretId: secret.id,
          secretType: secret.secretType,
          collectionId,
        }),
      },
    });

    return {
      ...secret,
      encryptedValue: '••••••••',
    };
  }

  async removeSecret(secretId: string, user: any) {
    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new ForbiddenException('Only Owners and Admins can delete secrets.');
    }
    const secret = await this.prisma.vaultSecret.findUnique({ where: { id: secretId } });
    if (!secret) throw new NotFoundException(`Secret not found`);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'deletion',
        details: JSON.stringify({ action: 'delete_secret', secretId, tool: secret.tool }),
      },
    });

    return this.prisma.vaultSecret.delete({ where: { id: secretId } });
  }

  // 3. Plaintext Reveal & Re-authentication & TTL check
  async revealSecret(secretId: string, data: any, user: any, ipAddress?: string, userAgent?: string) {
    // A. Re-authenticate user's current password for high-risk action
    if (!data.confirmPassword) {
      throw new UnauthorizedException('Re-authentication required. Please supply your password.');
    }
    const fullUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!fullUser) {
      throw new UnauthorizedException('User not found');
    }
    const isMatch = await bcrypt.compare(data.confirmPassword, fullUser.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Re-authentication failed. Incorrect password.');
    }

    const secret = await this.prisma.vaultSecret.findUnique({
      where: { id: secretId },
      include: {
        collection: {
          include: {
            project: {
              include: {
                assignments: true,
              },
            },
          },
        },
      },
    });
    if (!secret) throw new NotFoundException(`Secret not found`);

    // B. Authorization check: Owner/Admin automatically get access.
    // Finance role is NOT allowed to view credentials.
    // Employee requires active project assignment AND approved non-expired AccessRequest.
    if (user.role === 'finance') {
      throw new ForbiddenException('Finance/Accounts roles are restricted from reading project credentials.');
    }

    if (user.role === 'employee') {
      const isAssigned = secret.collection.project.assignments.some((a) => a.employeeId === user.id);
      if (!isAssigned) {
        throw new ForbiddenException('Access denied. You are not assigned to this project.');
      }

      // Check-on-read TTL and active access request validation
      const now = new Date();
      const activeGrant = await this.prisma.accessRequest.findFirst({
        where: {
          projectId: secret.collection.projectId,
          requesterId: user.id,
          status: 'approved',
          expiresAt: { gte: now },
        },
      });

      if (!activeGrant) {
        throw new ForbiddenException('Access denied. No active and approved vault access request found for this project.');
      }
    }

    // C. Decrypt secret and record reveal to Audit Log
    const decrypted = this.encryptionService.decrypt(secret.encryptedValue);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'password_reveal',
        details: JSON.stringify({
          action: 'reveal_secret',
          secretId: secret.id,
          tool: secret.tool,
          environment: secret.environment,
          projectId: secret.collection.projectId,
        }),
        ipAddress,
        userAgent,
      },
    });

    return {
      secretId: secret.id,
      decryptedValue: decrypted,
    };
  }

  // 4. Access Requests
  async createRequest(data: any, user: any) {
    const durationHours = Number(data.durationHours || 24);
    const expiresAt = new Date(Date.now() + durationHours * 3600000);

    return this.prisma.accessRequest.create({
      data: {
        requesterId: user.id,
        projectId: data.projectId,
        secretScope: data.secretScope || 'collection',
        expiresAt,
        status: 'pending',
      },
    });
  }

  async findAllRequests(user: any) {
    const where: any = {};
    // Employees see only their own requests. Owners/Admins see all.
    if (user.role === 'employee') {
      where.requesterId = user.id;
    }

    return this.prisma.accessRequest.findMany({
      where,
      include: {
        requester: true,
        project: true,
        approver: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveRequest(requestId: string, user: any) {
    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new ForbiddenException('Only Owners and Admins can approve access requests.');
    }

    const req = await this.prisma.accessRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException(`Request not found`);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'access_approved',
        details: JSON.stringify({ action: 'approve_request', requestId, requesterId: req.requesterId, projectId: req.projectId }),
      },
    });

    return this.prisma.accessRequest.update({
      where: { id: requestId },
      data: {
        status: 'approved',
        approverId: user.id,
        approvalTimestamp: new Date(),
      },
    });
  }

  async rejectRequest(requestId: string, user: any) {
    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new ForbiddenException('Only Owners and Admins can reject requests.');
    }

    return this.prisma.accessRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
      },
    });
  }

  async revokeRequest(requestId: string, user: any) {
    const req = await this.prisma.accessRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException(`Request not found`);

    if (user.role !== 'owner' && user.role !== 'admin' && req.requesterId !== user.id) {
      throw new ForbiddenException('Unauthorized to revoke this request.');
    }

    return this.prisma.accessRequest.update({
      where: { id: requestId },
      data: {
        status: 'revoked',
      },
    });
  }

  // 5. Rotation Tasks (Pending Rotation Queue)
  async getRotationQueue(user: any) {
    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new ForbiddenException('Only Owners and Admins can view the credential rotation queue.');
    }

    return this.prisma.rotationTask.findMany({
      where: {
        status: { in: ['pending', 'snoozed'] },
      },
      include: {
        collection: {
          include: {
            project: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async completeRotation(taskId: string, data: any, user: any) {
    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new ForbiddenException('Only Owners and Admins can complete credential rotation.');
    }

    const task = await this.prisma.rotationTask.findUnique({
      where: { id: taskId },
      include: { collection: true },
    });
    if (!task) throw new NotFoundException(`Rotation task not found`);

    // A. Update the corresponding secrets inside the collection
    const secrets = await this.prisma.vaultSecret.findMany({
      where: { collectionId: task.collectionId },
    });

    // If new password is provided, update all secrets in that collection
    if (data.newSecretValue) {
      const encryptedValue = this.encryptionService.encrypt(data.newSecretValue);
      for (const secret of secrets) {
        await this.prisma.vaultSecret.update({
          where: { id: secret.id },
          data: { encryptedValue },
        });

        // Add version
        const currentVersions = await this.prisma.vaultSecretVersion.count({ where: { secretId: secret.id } });
        await this.prisma.vaultSecretVersion.create({
          data: {
            secretId: secret.id,
            version: currentVersions + 1,
            encryptedValue,
          },
        });
      }
    }

    // B. Update rotation task status
    await this.prisma.rotationTask.update({
      where: { id: taskId },
      data: { status: 'completed' },
    });

    // C. Update vault collection metadata
    await this.prisma.vaultCollection.update({
      where: { id: task.collectionId },
      data: { lastRotationDate: new Date() },
    });

    // D. Check if there are other pending rotation tasks for this project
    const remainingTasks = await this.prisma.rotationTask.count({
      where: {
        collection: { projectId: task.collection.projectId },
        status: 'pending',
      },
    });

    if (remainingTasks === 0) {
      // Transition project status from completed_pending_rotation -> rotated
      await this.prisma.project.update({
        where: { id: task.collection.projectId },
        data: { status: 'rotated' },
      });
    }

    // E. Log change to Audit trail
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'password_change',
        details: JSON.stringify({ action: 'complete_rotation', taskId, collectionId: task.collectionId, projectId: task.collection.projectId }),
      },
    });

    return { success: true };
  }

  async snoozeRotation(taskId: string, data: any, user: any) {
    if (user.role !== 'owner' && user.role !== 'admin') {
      throw new ForbiddenException('Only Owners and Admins can snoop/postpone rotations.');
    }

    const snoozeDays = Number(data.snoozeDays || 7);
    const snoozedUntil = new Date(Date.now() + snoozeDays * 24 * 3600000);

    return this.prisma.rotationTask.update({
      where: { id: taskId },
      data: {
        status: 'snoozed',
        snoozedUntil,
        reason: data.reason || 'Snoozed by administrator',
      },
    });
  }
}
