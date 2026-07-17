import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';

@Injectable()
export class TechnologyVaultService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // ─── Catalogue ────────────────────────────────────────

  async listCatalogue(search?: string) {
    return this.prisma.technologyCatalogue.findMany({
      where: {
        active: true,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { fieldDefinitions: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async getCatalogue(id: string) {
    const tech = await this.prisma.technologyCatalogue.findUnique({
      where: { id },
      include: { fieldDefinitions: { orderBy: { displayOrder: 'asc' } }, accounts: { include: { environments: true, projectLinks: { include: { project: true } } } } },
    });
    if (!tech) throw new NotFoundException('Technology not found');
    return tech;
  }

  async createCatalogue(data: any) {
    return this.prisma.technologyCatalogue.create({ data });
  }

  // ─── Accounts ─────────────────────────────────────────

  async listAccounts(filters: {
    search?: string; technologyId?: string; projectId?: string;
    category?: string; status?: string; page?: number; limit?: number;
  }) {
    const { search, technologyId, projectId, category, status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (technologyId) where.technologyId = technologyId;
    if (status) where.status = status;
    if (search) where.OR = [{ accountName: { contains: search, mode: 'insensitive' } }, { accountIdentifier: { contains: search, mode: 'insensitive' } }];
    if (projectId) where.projectLinks = { some: { projectId } };
    if (category) where.technology = { category };

    const [items, total] = await Promise.all([
      this.prisma.technologyAccount.findMany({
        where,
        skip,
        take: limit,
        include: {
          technology: true,
          environments: true,
          projectLinks: { include: { project: true } },
          grants: { where: { active: true } },
          fields: { select: { id: true, fieldKey: true, fieldLabel: true, isSecret: true, nonSecretValue: true, environmentId: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.technologyAccount.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getAccount(id: string) {
    const acc = await this.prisma.technologyAccount.findUnique({
      where: { id },
      include: {
        technology: { include: { fieldDefinitions: { orderBy: { displayOrder: 'asc' } } } },
        environments: true,
        projectLinks: { include: { project: { include: { client: true } } } },
        fields: true,
        grants: { where: { active: true } },
        accessRequests: { orderBy: { requestedAt: 'desc' }, take: 10 },
      },
    });
    if (!acc) throw new NotFoundException('Account not found');
    // Mask secret fields
    acc.fields = acc.fields.map((f: any) => ({ ...f, encryptedValue: f.isSecret ? '••••••••' : f.encryptedValue }));
    return acc;
  }

  async createAccount(technologyId: string, data: any) {
    return this.prisma.technologyAccount.create({
      data: { ...data, technologyId },
      include: { technology: true },
    });
  }

  async updateAccount(id: string, data: any) {
    return this.prisma.technologyAccount.update({ where: { id }, data });
  }

  async deleteAccount(id: string) {
    await this.prisma.technologyAccount.delete({ where: { id } });
    return { message: 'Account deleted' };
  }

  // ─── Environments ──────────────────────────────────────

  async createEnvironment(accountId: string, data: any) {
    return this.prisma.technologyEnvironment.create({ data: { ...data, technologyAccountId: accountId } });
  }

  // ─── Fields ────────────────────────────────────────────

  async createField(accountId: string, data: any) {
    const { value, isSecret, ...rest } = data;
    const encryptedValue = isSecret && value ? this.encryption.encrypt(value) : undefined;
    const nonSecretValue = !isSecret ? value : undefined;
    return this.prisma.technologyAccountField.create({
      data: { ...rest, technologyAccountId: accountId, isSecret, encryptedValue, nonSecretValue },
    });
  }

  async updateField(fieldId: string, data: any) {
    const { value, isSecret, ...rest } = data;
    const encryptedValue = isSecret && value ? this.encryption.encrypt(value) : undefined;
    const nonSecretValue = !isSecret && value ? value : undefined;
    return this.prisma.technologyAccountField.update({
      where: { id: fieldId },
      data: { ...rest, ...(encryptedValue ? { encryptedValue } : {}), ...(nonSecretValue ? { nonSecretValue } : {}) },
    });
  }

  async revealField(fieldId: string, employeeId: string, userRole: string, ipAddress: string, userAgent: string) {
    const field = await this.prisma.technologyAccountField.findUnique({
      where: { id: fieldId },
      include: { technologyAccount: true },
    });
    if (!field) throw new NotFoundException('Field not found');

    // Owners/admins can always reveal
    if (!['owner', 'admin'].includes(userRole)) {
      const grant = await this.prisma.employeeCredentialGrant.findFirst({
        where: { accountFieldId: fieldId, employeeId, active: true, canReveal: true },
      });
      if (!grant) throw new NotFoundException('No active access grant for this field');
      if (grant.expiresAt && new Date() > grant.expiresAt) throw new NotFoundException('Access grant has expired');

      // Update lastAccessedAt
      await this.prisma.employeeCredentialGrant.update({ where: { id: grant.id }, data: { lastAccessedAt: new Date() } });

      // Single use: revoke after first reveal
      if (grant.singleUse) {
        await this.prisma.employeeCredentialGrant.update({ where: { id: grant.id }, data: { active: false, revokedAt: new Date() } });
      }
    }

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: employeeId,
        action: 'credential_revealed',
        details: `Field ${field.fieldLabel} (${field.fieldKey}) revealed for account ${field.technologyAccountId}`,
        ipAddress,
        userAgent,
      },
    });

    if (!field.isSecret) return { value: field.nonSecretValue };
    if (!field.encryptedValue) return { value: null };
    return { value: this.encryption.decrypt(field.encryptedValue) };
  }

  // ─── Project Linking ───────────────────────────────────

  async linkToProject(projectId: string, technologyAccountId: string, connectionType?: string) {
    const existing = await this.prisma.projectTechnologyLink.findFirst({
      where: { projectId, technologyAccountId },
    });
    if (existing) {
      return this.prisma.projectTechnologyLink.update({
        where: { id: existing.id },
        data: { active: true, connectionType },
      });
    }
    return this.prisma.projectTechnologyLink.create({
      data: { projectId, technologyAccountId, connectionType, active: true },
    });
  }

  async unlinkFromProject(projectId: string, technologyAccountId: string) {
    const existing = await this.prisma.projectTechnologyLink.findFirst({
      where: { projectId, technologyAccountId },
    });
    if (existing) {
      await this.prisma.projectTechnologyLink.update({
        where: { id: existing.id },
        data: { active: false },
      });
    }
    return { message: 'Unlinked' };
  }

  async getProjectTechnologies(projectId: string) {
    return this.prisma.projectTechnologyLink.findMany({
      where: { projectId, active: true },
      include: {
        technologyAccount: {
          include: {
            technology: true,
            environments: true,
            fields: { select: { id: true, fieldKey: true, fieldLabel: true, isSecret: true, nonSecretValue: true } },
          },
        },
      },
    });
  }

  // ─── Vault Search ──────────────────────────────────────

  async vaultSearch(query: string, filters: any) {
    const where: any = {};
    if (query) where.OR = [
      { accountName: { contains: query, mode: 'insensitive' } },
      { technology: { name: { contains: query, mode: 'insensitive' } } },
    ];
    if (filters.category) where.technology = { category: filters.category };
    if (filters.projectId) where.projectLinks = { some: { projectId: filters.projectId } };
    if (filters.status) where.status = filters.status;

    return this.prisma.technologyAccount.findMany({
      where,
      include: {
        technology: true,
        environments: true,
        projectLinks: { include: { project: { include: { client: true } } } },
        grants: { where: { active: true }, include: { technologyAccount: true } },
        fields: { select: { id: true, fieldKey: true, fieldLabel: true, isSecret: true, nonSecretValue: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ─── Field Access Requests ─────────────────────────────

  async createAccessRequest(data: {
    requesterId: string; projectId: string; technologyAccountId: string;
    environmentId?: string; requestReason: string; taskReference?: string;
    urgency?: string; requestedDurationMin?: number; fieldIds: string[];
  }) {
    const req = await this.prisma.vaultFieldAccessRequest.create({
      data: {
        requesterId: data.requesterId,
        projectId: data.projectId,
        technologyAccountId: data.technologyAccountId,
        environmentId: data.environmentId,
        requestReason: data.requestReason,
        taskReference: data.taskReference,
        urgency: data.urgency || 'normal',
        requestedDurationMin: data.requestedDurationMin,
        requestedFields: {
          create: data.fieldIds.map((fId) => ({ accountFieldId: fId })),
        },
      },
      include: { requestedFields: true },
    });

    // Notify owners
    const owners = await this.prisma.user.findMany({ where: { role: { in: ['owner', 'admin'] } } });
    for (const owner of owners) {
      await this.prisma.notification.create({
        data: {
          userId: owner.id,
          type: 'credential_request',
          title: 'New Credential Access Request',
          message: `An employee has requested access to ${data.fieldIds.length} credential field(s) for project ${data.projectId}.`,
          metadata: JSON.stringify({ requestId: req.id }),
        },
      });
    }

    return req;
  }

  async listAccessRequests(filters: { status?: string; projectId?: string; requesterId?: string }) {
    return this.prisma.vaultFieldAccessRequest.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.requesterId ? { requesterId: filters.requesterId } : {}),
      },
      include: {
        technologyAccount: { include: { technology: true } },
        requestedFields: { include: { accountField: { select: { id: true, fieldKey: true, fieldLabel: true, isSecret: true } } } },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async approveAccessRequest(requestId: string, approvedById: string, approvals: { fieldId: string; canReveal: boolean; canCopy: boolean; singleUse: boolean }[], durationMin?: number) {
    const req = await this.prisma.vaultFieldAccessRequest.findUnique({ where: { id: requestId }, include: { requestedFields: true } });
    if (!req) throw new NotFoundException('Request not found');

    const expiresAt = durationMin ? new Date(Date.now() + durationMin * 60 * 1000) : undefined;
    const approvedFieldIds = approvals.filter((a) => a.canReveal).map((a) => a.fieldId);
    const allApproved = approvedFieldIds.length === req.requestedFields.length;

    // Update each requested field
    for (const approval of approvals) {
      const rf = req.requestedFields.find((f) => f.accountFieldId === approval.fieldId);
      if (!rf) continue;
      await this.prisma.vaultRequestedField.update({
        where: { id: rf.id },
        data: { approved: approval.canReveal, canReveal: approval.canReveal, canCopy: approval.canCopy, singleUse: approval.singleUse },
      });

      if (approval.canReveal) {
        await this.prisma.employeeCredentialGrant.create({
          data: {
            employeeId: req.requesterId,
            projectId: req.projectId,
            technologyAccountId: req.technologyAccountId,
            accountFieldId: approval.fieldId,
            environmentId: req.environmentId,
            requestId: req.id,
            approvedById,
            canReveal: approval.canReveal,
            canCopy: approval.canCopy,
            singleUse: approval.singleUse,
            expiresAt,
          },
        });
      }
    }

    const newStatus = allApproved ? 'approved' : approvedFieldIds.length > 0 ? 'partial' : 'rejected';
    await this.prisma.vaultFieldAccessRequest.update({
      where: { id: requestId },
      data: { status: newStatus, reviewedAt: new Date(), approvedById, expiresAt },
    });

    // Notify requester
    await this.prisma.notification.create({
      data: {
        userId: req.requesterId,
        type: newStatus === 'rejected' ? 'credential_request' : 'credential_approved',
        title: `Credential Request ${newStatus === 'approved' ? 'Approved' : newStatus === 'partial' ? 'Partially Approved' : 'Rejected'}`,
        message: `Your credential access request has been ${newStatus}. ${approvedFieldIds.length} of ${req.requestedFields.length} fields approved.`,
        metadata: JSON.stringify({ requestId }),
      },
    });

    return { status: newStatus, approvedFields: approvedFieldIds.length };
  }

  async rejectAccessRequest(requestId: string, reason: string) {
    await this.prisma.vaultFieldAccessRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', rejectedReason: reason, reviewedAt: new Date() },
    });
    return { message: 'Request rejected' };
  }

  async revokeGrant(grantId: string) {
    await this.prisma.employeeCredentialGrant.update({
      where: { id: grantId },
      data: { active: false, revokedAt: new Date() },
    });
    return { message: 'Grant revoked' };
  }

  // ─── Employee Access Registry ──────────────────────────

  async getEmployeeCredentialAccess(employeeId: string) {
    return this.prisma.employeeCredentialGrant.findMany({
      where: { employeeId },
      include: {
        accountField: { include: { technologyAccount: { include: { technology: true } } } },
        technologyAccount: { include: { technology: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
  }

  // ─── Subscription Expiry ───────────────────────────────

  async getExpiringSubscriptions(days = 30) {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.prisma.technologyAccount.findMany({
      where: {
        isLifetime: false,
        subscriptionStatus: 'active',
        nextBillingDate: { lte: cutoff, gte: new Date() },
      },
      include: { technology: true, projectLinks: { include: { project: true } } },
      orderBy: { nextBillingDate: 'asc' },
    });
  }

  // ─── Seed catalogue ────────────────────────────────────

  async seedCatalogue() {
    const technologies = [
      { name: 'GitHub', vendor: 'GitHub Inc.', category: 'Source Control', officialUrl: 'https://github.com', supportsSubscription: true, supportsEnvironments: true, supportsRotation: true,
        fields: [
          { fieldKey: 'username', fieldLabel: 'Username', fieldType: 'text', isSecret: false, isRequired: true, displayOrder: 1 },
          { fieldKey: 'email', fieldLabel: 'Login Email', fieldType: 'text', isSecret: false, isRequired: true, displayOrder: 2 },
          { fieldKey: 'password', fieldLabel: 'Password', fieldType: 'password', isSecret: true, isRequired: false, displayOrder: 3 },
          { fieldKey: 'personal_access_token', fieldLabel: 'Personal Access Token', fieldType: 'password', isSecret: true, displayOrder: 4 },
          { fieldKey: 'ssh_private_key', fieldLabel: 'SSH Private Key', fieldType: 'textarea', isSecret: true, displayOrder: 5 },
          { fieldKey: 'ssh_public_key', fieldLabel: 'SSH Public Key', fieldType: 'textarea', isSecret: false, displayOrder: 6 },
          { fieldKey: 'org_name', fieldLabel: 'Organisation Name', fieldType: 'text', isSecret: false, displayOrder: 7 },
          { fieldKey: 'repo_urls', fieldLabel: 'Repository URLs', fieldType: 'textarea', isSecret: false, displayOrder: 8 },
          { fieldKey: 'recovery_email', fieldLabel: 'Recovery Email', fieldType: 'text', isSecret: false, displayOrder: 9 },
          { fieldKey: 'two_factor_status', fieldLabel: '2FA Status', fieldType: 'boolean', isSecret: false, displayOrder: 10 },
          { fieldKey: 'recovery_codes', fieldLabel: 'Recovery Codes', fieldType: 'textarea', isSecret: true, displayOrder: 11 },
        ]
      },
      { name: 'GitLab', vendor: 'GitLab Inc.', category: 'Source Control', officialUrl: 'https://gitlab.com', supportsSubscription: true, supportsEnvironments: true, supportsRotation: true,
        fields: [
          { fieldKey: 'username', fieldLabel: 'Username', fieldType: 'text', isSecret: false, isRequired: true, displayOrder: 1 },
          { fieldKey: 'email', fieldLabel: 'Email', fieldType: 'text', isSecret: false, displayOrder: 2 },
          { fieldKey: 'password', fieldLabel: 'Password', fieldType: 'password', isSecret: true, displayOrder: 3 },
          { fieldKey: 'access_token', fieldLabel: 'Access Token', fieldType: 'password', isSecret: true, displayOrder: 4 },
          { fieldKey: 'runner_token', fieldLabel: 'CI Runner Token', fieldType: 'password', isSecret: true, displayOrder: 5 },
        ]
      },
      { name: 'AWS', vendor: 'Amazon Web Services', category: 'Cloud Infrastructure', officialUrl: 'https://aws.amazon.com', supportsSubscription: true, supportsEnvironments: true, supportsRotation: true,
        fields: [
          { fieldKey: 'account_id', fieldLabel: 'Account ID', fieldType: 'text', isSecret: false, isRequired: true, displayOrder: 1 },
          { fieldKey: 'root_email', fieldLabel: 'Root Email', fieldType: 'text', isSecret: false, displayOrder: 2 },
          { fieldKey: 'access_key_id', fieldLabel: 'Access Key ID', fieldType: 'text', isSecret: true, displayOrder: 3 },
          { fieldKey: 'secret_access_key', fieldLabel: 'Secret Access Key', fieldType: 'password', isSecret: true, displayOrder: 4 },
          { fieldKey: 'region', fieldLabel: 'Default Region', fieldType: 'text', isSecret: false, displayOrder: 5 },
          { fieldKey: 'iam_user', fieldLabel: 'IAM User', fieldType: 'text', isSecret: false, displayOrder: 6 },
          { fieldKey: 'mfa_serial', fieldLabel: 'MFA Serial Number', fieldType: 'text', isSecret: false, displayOrder: 7 },
        ]
      },
      { name: 'Google Cloud', vendor: 'Google LLC', category: 'Cloud Infrastructure', officialUrl: 'https://cloud.google.com', supportsSubscription: true, supportsEnvironments: true, supportsRotation: true,
        fields: [
          { fieldKey: 'project_id', fieldLabel: 'Project ID', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'service_account_email', fieldLabel: 'Service Account Email', fieldType: 'text', displayOrder: 2 },
          { fieldKey: 'service_account_key', fieldLabel: 'Service Account Key JSON', fieldType: 'textarea', isSecret: true, displayOrder: 3 },
          { fieldKey: 'api_key', fieldLabel: 'API Key', fieldType: 'password', isSecret: true, displayOrder: 4 },
        ]
      },
      { name: 'Vercel', vendor: 'Vercel Inc.', category: 'Hosting', officialUrl: 'https://vercel.com', supportsSubscription: true, supportsEnvironments: true,
        fields: [
          { fieldKey: 'email', fieldLabel: 'Account Email', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'api_token', fieldLabel: 'API Token', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'team_id', fieldLabel: 'Team ID', fieldType: 'text', displayOrder: 3 },
          { fieldKey: 'project_id', fieldLabel: 'Project ID', fieldType: 'text', displayOrder: 4 },
        ]
      },
      { name: 'Netlify', vendor: 'Netlify Inc.', category: 'Hosting', officialUrl: 'https://netlify.com', supportsSubscription: true, supportsEnvironments: true,
        fields: [
          { fieldKey: 'email', fieldLabel: 'Account Email', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'personal_access_token', fieldLabel: 'Personal Access Token', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'site_id', fieldLabel: 'Site ID', fieldType: 'text', displayOrder: 3 },
        ]
      },
      { name: 'Firebase', vendor: 'Google LLC', category: 'Cloud Infrastructure', officialUrl: 'https://firebase.google.com', supportsEnvironments: true,
        fields: [
          { fieldKey: 'project_id', fieldLabel: 'Firebase Project ID', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'api_key', fieldLabel: 'Web API Key', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'service_account_json', fieldLabel: 'Service Account JSON', fieldType: 'textarea', isSecret: true, displayOrder: 3 },
          { fieldKey: 'database_url', fieldLabel: 'Database URL', fieldType: 'url', displayOrder: 4 },
        ]
      },
      { name: 'Supabase', vendor: 'Supabase Inc.', category: 'Database', officialUrl: 'https://supabase.com', supportsEnvironments: true,
        fields: [
          { fieldKey: 'project_url', fieldLabel: 'Project URL', fieldType: 'url', isRequired: true, displayOrder: 1 },
          { fieldKey: 'anon_key', fieldLabel: 'Anon (Public) Key', fieldType: 'password', isSecret: false, displayOrder: 2 },
          { fieldKey: 'service_role_key', fieldLabel: 'Service Role Key', fieldType: 'password', isSecret: true, displayOrder: 3 },
          { fieldKey: 'database_password', fieldLabel: 'Database Password', fieldType: 'password', isSecret: true, displayOrder: 4 },
        ]
      },
      { name: 'Cloudflare', vendor: 'Cloudflare Inc.', category: 'Domain and DNS', officialUrl: 'https://cloudflare.com', supportsSubscription: true,
        fields: [
          { fieldKey: 'email', fieldLabel: 'Account Email', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'api_token', fieldLabel: 'API Token', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'account_id', fieldLabel: 'Account ID', fieldType: 'text', displayOrder: 3 },
          { fieldKey: 'zone_id', fieldLabel: 'Zone ID', fieldType: 'text', displayOrder: 4 },
        ]
      },
      { name: 'GoDaddy', vendor: 'GoDaddy Inc.', category: 'Domain and DNS', officialUrl: 'https://godaddy.com', supportsSubscription: true,
        fields: [
          { fieldKey: 'username', fieldLabel: 'Username', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'password', fieldLabel: 'Password', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'api_key', fieldLabel: 'API Key', fieldType: 'password', isSecret: true, displayOrder: 3 },
          { fieldKey: 'api_secret', fieldLabel: 'API Secret', fieldType: 'password', isSecret: true, displayOrder: 4 },
        ]
      },
      { name: 'Stripe', vendor: 'Stripe Inc.', category: 'Payment Gateway', officialUrl: 'https://stripe.com', supportsSubscription: true, supportsRotation: true,
        fields: [
          { fieldKey: 'publishable_key', fieldLabel: 'Publishable Key', fieldType: 'text', isSecret: false, isRequired: true, displayOrder: 1 },
          { fieldKey: 'secret_key', fieldLabel: 'Secret Key', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 2 },
          { fieldKey: 'webhook_secret', fieldLabel: 'Webhook Secret', fieldType: 'password', isSecret: true, displayOrder: 3 },
          { fieldKey: 'account_id', fieldLabel: 'Account ID', fieldType: 'text', displayOrder: 4 },
        ]
      },
      { name: 'Razorpay', vendor: 'Razorpay Software Pvt. Ltd.', category: 'Payment Gateway', officialUrl: 'https://razorpay.com', supportsRotation: true,
        fields: [
          { fieldKey: 'key_id', fieldLabel: 'Key ID', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'key_secret', fieldLabel: 'Key Secret', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 2 },
          { fieldKey: 'webhook_secret', fieldLabel: 'Webhook Secret', fieldType: 'password', isSecret: true, displayOrder: 3 },
        ]
      },
      { name: 'OpenAI', vendor: 'OpenAI', category: 'Artificial Intelligence', officialUrl: 'https://openai.com', supportsRotation: true,
        fields: [
          { fieldKey: 'api_key', fieldLabel: 'API Key', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 1 },
          { fieldKey: 'org_id', fieldLabel: 'Organization ID', fieldType: 'text', displayOrder: 2 },
          { fieldKey: 'model', fieldLabel: 'Default Model', fieldType: 'text', displayOrder: 3 },
        ]
      },
      { name: 'Anthropic', vendor: 'Anthropic PBC', category: 'Artificial Intelligence', officialUrl: 'https://anthropic.com', supportsRotation: true,
        fields: [
          { fieldKey: 'api_key', fieldLabel: 'API Key', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 1 },
        ]
      },
      { name: 'Twilio', vendor: 'Twilio Inc.', category: 'Communication', officialUrl: 'https://twilio.com', supportsRotation: true,
        fields: [
          { fieldKey: 'account_sid', fieldLabel: 'Account SID', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'auth_token', fieldLabel: 'Auth Token', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 2 },
          { fieldKey: 'phone_number', fieldLabel: 'Phone Number', fieldType: 'text', displayOrder: 3 },
        ]
      },
      { name: 'SendGrid', vendor: 'Twilio Inc.', category: 'Email', officialUrl: 'https://sendgrid.com', supportsRotation: true,
        fields: [
          { fieldKey: 'api_key', fieldLabel: 'API Key', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 1 },
          { fieldKey: 'sender_email', fieldLabel: 'Verified Sender Email', fieldType: 'text', displayOrder: 2 },
        ]
      },
      { name: 'Figma', vendor: 'Figma Inc.', category: 'Design', officialUrl: 'https://figma.com', supportsSubscription: true,
        fields: [
          { fieldKey: 'email', fieldLabel: 'Account Email', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'password', fieldLabel: 'Password', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'personal_access_token', fieldLabel: 'Personal Access Token', fieldType: 'password', isSecret: true, displayOrder: 3 },
          { fieldKey: 'team_id', fieldLabel: 'Team ID', fieldType: 'text', displayOrder: 4 },
        ]
      },
      { name: 'Notion', vendor: 'Notion Labs Inc.', category: 'Project Management', officialUrl: 'https://notion.so', supportsSubscription: true,
        fields: [
          { fieldKey: 'email', fieldLabel: 'Account Email', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'integration_token', fieldLabel: 'Integration Token', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'workspace_id', fieldLabel: 'Workspace ID', fieldType: 'text', displayOrder: 3 },
        ]
      },
      { name: 'Slack', vendor: 'Slack Technologies LLC', category: 'Communication', officialUrl: 'https://slack.com', supportsSubscription: true,
        fields: [
          { fieldKey: 'workspace_url', fieldLabel: 'Workspace URL', fieldType: 'url', isRequired: true, displayOrder: 1 },
          { fieldKey: 'bot_token', fieldLabel: 'Bot Token', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'webhook_url', fieldLabel: 'Webhook URL', fieldType: 'url', isSecret: true, displayOrder: 3 },
          { fieldKey: 'admin_email', fieldLabel: 'Admin Email', fieldType: 'text', displayOrder: 4 },
        ]
      },
      { name: 'Jira', vendor: 'Atlassian', category: 'Project Management', officialUrl: 'https://atlassian.com/software/jira', supportsSubscription: true,
        fields: [
          { fieldKey: 'email', fieldLabel: 'Account Email', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'api_token', fieldLabel: 'API Token', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'domain', fieldLabel: 'Atlassian Domain', fieldType: 'url', displayOrder: 3 },
          { fieldKey: 'project_key', fieldLabel: 'Project Key', fieldType: 'text', displayOrder: 4 },
        ]
      },
      { name: 'Linear', vendor: 'Linear Orbit Inc.', category: 'Project Management', officialUrl: 'https://linear.app', supportsSubscription: true,
        fields: [
          { fieldKey: 'api_key', fieldLabel: 'API Key', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 1 },
          { fieldKey: 'team_id', fieldLabel: 'Team ID', fieldType: 'text', displayOrder: 2 },
        ]
      },
      { name: 'ClickUp', vendor: 'Mango Technologies Inc.', category: 'Project Management', officialUrl: 'https://clickup.com', supportsSubscription: true,
        fields: [
          { fieldKey: 'api_token', fieldLabel: 'API Token', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 1 },
          { fieldKey: 'workspace_id', fieldLabel: 'Workspace ID', fieldType: 'text', displayOrder: 2 },
        ]
      },
      { name: 'DigitalOcean', vendor: 'DigitalOcean LLC', category: 'Cloud Infrastructure', officialUrl: 'https://digitalocean.com', supportsSubscription: true, supportsEnvironments: true,
        fields: [
          { fieldKey: 'api_token', fieldLabel: 'API Token', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 1 },
          { fieldKey: 'spaces_key', fieldLabel: 'Spaces Access Key', fieldType: 'text', isSecret: true, displayOrder: 2 },
          { fieldKey: 'spaces_secret', fieldLabel: 'Spaces Secret', fieldType: 'password', isSecret: true, displayOrder: 3 },
        ]
      },
      { name: 'MongoDB Atlas', vendor: 'MongoDB Inc.', category: 'Database', officialUrl: 'https://cloud.mongodb.com', supportsSubscription: true, supportsEnvironments: true,
        fields: [
          { fieldKey: 'connection_string', fieldLabel: 'Connection String', fieldType: 'textarea', isSecret: true, isRequired: true, displayOrder: 1 },
          { fieldKey: 'username', fieldLabel: 'DB Username', fieldType: 'text', displayOrder: 2 },
          { fieldKey: 'password', fieldLabel: 'DB Password', fieldType: 'password', isSecret: true, displayOrder: 3 },
          { fieldKey: 'cluster_url', fieldLabel: 'Cluster URL', fieldType: 'url', displayOrder: 4 },
        ]
      },
      { name: 'PostgreSQL', vendor: 'PostgreSQL Global Development Group', category: 'Database', officialUrl: 'https://postgresql.org', supportsEnvironments: true, supportsRotation: true,
        fields: [
          { fieldKey: 'host', fieldLabel: 'Host', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'port', fieldLabel: 'Port', fieldType: 'text', displayOrder: 2 },
          { fieldKey: 'database', fieldLabel: 'Database Name', fieldType: 'text', displayOrder: 3 },
          { fieldKey: 'username', fieldLabel: 'Username', fieldType: 'text', isRequired: true, displayOrder: 4 },
          { fieldKey: 'password', fieldLabel: 'Password', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 5 },
          { fieldKey: 'connection_string', fieldLabel: 'Connection String', fieldType: 'textarea', isSecret: true, displayOrder: 6 },
          { fieldKey: 'ssl_certificate', fieldLabel: 'SSL Certificate', fieldType: 'textarea', isSecret: true, displayOrder: 7 },
        ]
      },
      { name: 'MySQL', vendor: 'Oracle Corporation', category: 'Database', officialUrl: 'https://mysql.com', supportsEnvironments: true, supportsRotation: true,
        fields: [
          { fieldKey: 'host', fieldLabel: 'Host', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'port', fieldLabel: 'Port', fieldType: 'text', displayOrder: 2 },
          { fieldKey: 'database', fieldLabel: 'Database Name', fieldType: 'text', displayOrder: 3 },
          { fieldKey: 'username', fieldLabel: 'Username', fieldType: 'text', isRequired: true, displayOrder: 4 },
          { fieldKey: 'password', fieldLabel: 'Password', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 5 },
        ]
      },
      { name: 'Google Workspace', vendor: 'Google LLC', category: 'Email', officialUrl: 'https://workspace.google.com', supportsSubscription: true,
        fields: [
          { fieldKey: 'admin_email', fieldLabel: 'Admin Email', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'domain', fieldLabel: 'Domain', fieldType: 'text', displayOrder: 2 },
          { fieldKey: 'service_account_key', fieldLabel: 'Service Account Key JSON', fieldType: 'textarea', isSecret: true, displayOrder: 3 },
          { fieldKey: 'oauth_client_id', fieldLabel: 'OAuth Client ID', fieldType: 'text', isSecret: true, displayOrder: 4 },
          { fieldKey: 'oauth_client_secret', fieldLabel: 'OAuth Client Secret', fieldType: 'password', isSecret: true, displayOrder: 5 },
        ]
      },
      { name: 'Mailchimp', vendor: 'Intuit Inc.', category: 'Marketing', officialUrl: 'https://mailchimp.com', supportsSubscription: true,
        fields: [
          { fieldKey: 'api_key', fieldLabel: 'API Key', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 1 },
          { fieldKey: 'server_prefix', fieldLabel: 'Server Prefix', fieldType: 'text', displayOrder: 2 },
          { fieldKey: 'list_id', fieldLabel: 'Audience List ID', fieldType: 'text', displayOrder: 3 },
        ]
      },
      { name: 'HubSpot', vendor: 'HubSpot Inc.', category: 'CRM', officialUrl: 'https://hubspot.com', supportsSubscription: true, supportsOAuth: true,
        fields: [
          { fieldKey: 'api_key', fieldLabel: 'Private App Access Token', fieldType: 'password', isSecret: true, isRequired: true, displayOrder: 1 },
          { fieldKey: 'portal_id', fieldLabel: 'Portal ID', fieldType: 'text', displayOrder: 2 },
        ]
      },
      { name: 'Zoho', vendor: 'Zoho Corporation', category: 'CRM', officialUrl: 'https://zoho.com', supportsSubscription: true, supportsOAuth: true,
        fields: [
          { fieldKey: 'client_id', fieldLabel: 'Client ID', fieldType: 'text', displayOrder: 1 },
          { fieldKey: 'client_secret', fieldLabel: 'Client Secret', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'access_token', fieldLabel: 'Access Token', fieldType: 'password', isSecret: true, displayOrder: 3 },
          { fieldKey: 'refresh_token', fieldLabel: 'Refresh Token', fieldType: 'password', isSecret: true, displayOrder: 4 },
        ]
      },
      { name: 'Namecheap', vendor: 'Namecheap Inc.', category: 'Domain and DNS', officialUrl: 'https://namecheap.com', supportsSubscription: true,
        fields: [
          { fieldKey: 'username', fieldLabel: 'Username', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'password', fieldLabel: 'Password', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'api_key', fieldLabel: 'API Key', fieldType: 'password', isSecret: true, displayOrder: 3 },
        ]
      },
      { name: 'Hostinger', vendor: 'Hostinger International Ltd.', category: 'Hosting', officialUrl: 'https://hostinger.com', supportsSubscription: true,
        fields: [
          { fieldKey: 'email', fieldLabel: 'Account Email', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'password', fieldLabel: 'Password', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'cpanel_password', fieldLabel: 'cPanel Password', fieldType: 'password', isSecret: true, displayOrder: 3 },
        ]
      },
      { name: 'Bitbucket', vendor: 'Atlassian', category: 'Source Control', officialUrl: 'https://bitbucket.org', supportsSubscription: true, supportsEnvironments: true,
        fields: [
          { fieldKey: 'username', fieldLabel: 'Username', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'app_password', fieldLabel: 'App Password', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'workspace', fieldLabel: 'Workspace', fieldType: 'text', displayOrder: 3 },
        ]
      },
      { name: 'Azure', vendor: 'Microsoft Corporation', category: 'Cloud Infrastructure', officialUrl: 'https://azure.microsoft.com', supportsSubscription: true, supportsEnvironments: true, supportsRotation: true,
        fields: [
          { fieldKey: 'subscription_id', fieldLabel: 'Subscription ID', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'tenant_id', fieldLabel: 'Tenant ID', fieldType: 'text', displayOrder: 2 },
          { fieldKey: 'client_id', fieldLabel: 'Client ID', fieldType: 'text', displayOrder: 3 },
          { fieldKey: 'client_secret', fieldLabel: 'Client Secret', fieldType: 'password', isSecret: true, displayOrder: 4 },
        ]
      },
      { name: 'Salesforce', vendor: 'Salesforce Inc.', category: 'CRM', officialUrl: 'https://salesforce.com', supportsSubscription: true, supportsOAuth: true,
        fields: [
          { fieldKey: 'username', fieldLabel: 'Username', fieldType: 'text', isRequired: true, displayOrder: 1 },
          { fieldKey: 'password', fieldLabel: 'Password', fieldType: 'password', isSecret: true, displayOrder: 2 },
          { fieldKey: 'security_token', fieldLabel: 'Security Token', fieldType: 'password', isSecret: true, displayOrder: 3 },
          { fieldKey: 'instance_url', fieldLabel: 'Instance URL', fieldType: 'url', displayOrder: 4 },
        ]
      },
    ];

    for (const tech of technologies) {
      const { fields, ...techData } = tech;
      try {
        const existing = await this.prisma.technologyCatalogue.findUnique({ where: { name: techData.name } });
        if (!existing) {
          await this.prisma.technologyCatalogue.create({
            data: {
              ...techData,
              fieldDefinitions: { create: fields || [] },
            },
          });
        }
      } catch (e) {
        // Already exists, skip
      }
    }
    console.log('[SEED] Technology catalogue seeded with 30+ providers.');
  }
}
