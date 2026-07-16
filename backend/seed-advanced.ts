import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Advanced Technology Vault and AI Dispatch mock data...');

  // 1. Get projects & users
  const projects = await prisma.project.findMany();
  const owners = await prisma.user.findMany({ where: { role: 'owner' } });
  const employees = await prisma.user.findMany({ where: { role: 'employee' } });

  if (projects.length === 0 || owners.length === 0) {
    console.error('No projects or owners found. Please run auth seed first.');
    return;
  }

  const owner = owners[0];
  const employee = employees[0];

  // 2. Get Catalogue technologies
  const techCatalogue = await prisma.technologyCatalogue.findMany({
    include: { fieldDefinitions: true },
  });

  if (techCatalogue.length === 0) {
    console.error('Technology Catalogue is empty. Please run tech seed first.');
    return;
  }

  // Clear existing mock vault/dispatch records first to avoid duplicates/conflicts
  await prisma.vaultRequestedField.deleteMany({});
  await prisma.vaultFieldAccessRequest.deleteMany({});
  await prisma.employeeCredentialGrant.deleteMany({});
  await prisma.technologyAccountField.deleteMany({});
  await prisma.technologyEnvironment.deleteMany({});
  await prisma.projectTechnologyLink.deleteMany({});
  await prisma.technologyAccount.deleteMany({});
  await prisma.dispatchDecision.deleteMany({});
  await prisma.dispatchActionItem.deleteMany({});
  await prisma.dispatchParticipant.deleteMany({});
  await prisma.dispatchTag.deleteMany({});
  await prisma.dispatchEntry.deleteMany({});
  await prisma.notification.deleteMany({});

  // 3. Seed Technology Accounts, Environments, and Fields
  console.log('Seeding technology accounts...');
  const techMap = new Map(techCatalogue.map(t => [t.name, t]));

  const accountsToSeed = [
    {
      techName: 'AWS',
      accountName: 'AWS Production Infrastructure',
      identifier: 'aws-prod-1102',
      ownerType: 'agency',
      isLifetime: false,
      billingCycle: 'monthly',
      billingAmount: 1850.0,
      billingCurrency: 'USD',
      nextBilling: new Date(Date.now() + 15 * 24 * 3600 * 1000),
      twoFactor: true,
      fields: {
        access_key_id: 'AKIAIOSFODNN7EXAMPLE',
        secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        console_password: 'AwsProdConsoleSecurePwd2026!',
      },
    },
    {
      techName: 'GitHub',
      accountName: 'Agency GitHub Organization',
      identifier: 'github-org-agency',
      ownerType: 'agency',
      isLifetime: false,
      billingCycle: 'monthly',
      billingAmount: 120.0,
      billingCurrency: 'USD',
      nextBilling: new Date(Date.now() + 20 * 24 * 3600 * 1000),
      twoFactor: true,
      fields: {
        organization_url: 'https://github.com/agency-suite-org',
        admin_token: 'ghp_agencyAdminTokenXyz98765432100000000',
        ssh_private_key: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtcn\n-----END OPENSSH PRIVATE KEY-----',
      },
    },
    {
      techName: 'Stripe',
      accountName: 'Stripe Global Payment gateway',
      identifier: 'stripe-agency-global',
      ownerType: 'agency',
      isLifetime: false,
      billingCycle: 'one_time',
      billingAmount: 0.0,
      billingCurrency: 'USD',
      twoFactor: true,
      fields: {
        public_key: 'example_public_key',
        secret_key: 'example_secret_key',
        webhook_signing_secret: 'example_webhook_secret',
      },
    },
    {
      techName: 'Vercel',
      accountName: 'Vercel Team Enterprise License',
      identifier: 'vercel-team-agency',
      ownerType: 'agency',
      isLifetime: false,
      billingCycle: 'monthly',
      billingAmount: 400.0,
      billingCurrency: 'USD',
      nextBilling: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      twoFactor: false,
      fields: {
        team_id: 'team_vercel_agency_suite',
        api_token: 'vcl_vercelApiTokenExampleKey00011',
      },
    },
    {
      techName: 'Slack',
      accountName: 'Agency Slack Workspace Pro',
      identifier: 'slack-agency-workspace',
      ownerType: 'agency',
      isLifetime: true,
      billingCycle: 'lifetime',
      billingAmount: 2500.0,
      billingCurrency: 'USD',
      twoFactor: true,
      fields: {
        workspace_url: 'https://agency-suite.slack.com',
        bot_user_oauth_token: 'xoxb-agencySlackBotTokenExampleXyz',
        signing_secret: 'slack_signing_secret_example_value_1122',
      },
    },
  ];

  const createdAccounts = [];

  for (const item of accountsToSeed) {
    const tech = techMap.get(item.techName);
    if (!tech) continue;

    const account = await prisma.technologyAccount.create({
      data: {
        technologyId: tech.id,
        accountName: item.accountName,
        accountIdentifier: item.identifier,
        ownerType: item.ownerType,
        status: 'active',
        isLifetime: item.isLifetime,
        subscriptionPlan: 'Enterprise / Pro',
        billingCycle: item.billingCycle,
        billingAmount: item.billingAmount,
        billingCurrency: item.billingCurrency,
        nextBillingDate: item.nextBilling,
        subscriptionStatus: 'active',
        twoFactorEnabled: item.twoFactor,
      },
    });

    createdAccounts.push({ account, item, tech });

    // Seed Environments
    const envs = ['production', 'staging', 'development'];
    for (const envName of envs) {
      const env = await prisma.technologyEnvironment.create({
        data: {
          technologyAccountId: account.id,
          environmentName: envName.charAt(0).toUpperCase() + envName.slice(1),
          environmentType: envName,
          url: envName === 'production' ? `https://api.${item.identifier}.com` : `https://${envName}.${item.identifier}.com`,
          active: true,
        },
      });

      // Seed fields under this environment
      for (const def of tech.fieldDefinitions) {
        const value = (item.fields as any)[def.fieldKey] || `mock_${def.fieldKey}_for_${envName}`;
        await prisma.technologyAccountField.create({
          data: {
            technologyAccountId: account.id,
            environmentId: env.id,
            fieldKey: def.fieldKey,
            fieldLabel: def.fieldLabel,
            isSecret: def.isSecret,
            nonSecretValue: def.isSecret ? null : value,
            encryptedValue: def.isSecret ? `encrypted:${value}` : null,
          },
        });
      }
    }
    console.log(`Seeded account: ${item.accountName}`);
  }

  // 4. Link accounts to projects
  console.log('Linking technology accounts to projects...');
  for (let i = 0; i < projects.length; i++) {
    const proj = projects[i];
    // Link 2-3 accounts to each project
    const linkAccounts = [
      createdAccounts[i % createdAccounts.length],
      createdAccounts[(i + 1) % createdAccounts.length],
    ];

    for (const ca of linkAccounts) {
      await prisma.projectTechnologyLink.create({
        data: {
          projectId: proj.id,
          technologyAccountId: ca.account.id,
          connectionType: 'primary',
        },
      });
    }
  }

  // 5. Seed Dispatch Entries (Communication Logs) with raw meeting logs
  console.log('Seeding dispatch entries...');
  const dispatchMockData = [
    {
      title: 'Initial Scoping Session — Alpha Cloud Migrations',
      type: 'meeting',
      raw: `Participants: Alice Owner (Owner), Jack Developer, Client Contact (John)
John: We want to migrate our legacy microservices onto AWS.
Alice: That sounds great. What's the target timeline?
John: We need this fully running in staging by September, and prod by November.
Jack: We will use Terraform to manage AWS resources so we can guarantee environment parity.
John: Excellent. Please also configure GitHub Actions for automatic deploy.
Jack: Yes, I will set up the pipeline.
John: I will provide the AWS console login credentials tomorrow.
Jack: Perfect, I will wait for it.
Alice: Let's schedule a follow-up review for next Tuesday.`,
      summary: 'Initial scoping session for Alpha Cloud Migrations project. Discussion centered on microservice migration onto AWS. Staging target is September, production by November. Jack will set up AWS resources using Terraform and configure CI/CD via GitHub Actions. John (Client) will provide AWS credentials tomorrow. Next review meeting scheduled for next Tuesday.',
      decisions: [
        'Use Terraform for AWS resource provisioning to ensure parity.',
        'Implement CI/CD deployment via GitHub Actions.',
        'Target deadline: Staging by September 2026, Production by November 2026.',
      ],
      actions: [
        { text: 'Provide AWS credentials', date: new Date(Date.now() + 1 * 24 * 3600 * 1000) },
        { text: 'Setup GitHub Actions deployment pipeline', date: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
        { text: 'Create initial Terraform infrastructure manifest', date: new Date(Date.now() + 10 * 24 * 3600 * 1000) },
      ],
      sentiment: 'positive',
    },
    {
      title: 'Urgent Bug Fix & Payment Integration Sync',
      type: 'call',
      raw: `Participants: Bob Admin (Admin), Sofia Rodriguez (Developer), Client Contact (Sarah)
Sarah: We noticed that Stripe webhooks are throwing 500 errors in staging.
Sofia: I checked the logs. It looks like the webhook signing secret is invalid or has expired.
Bob: Let's rotate the signing secret in Stripe and update the vault credential.
Sarah: Please do it today as it is blocking our billing test run.
Sofia: I will generate the new signing secret, update the Technology Vault, and verify webhook responses.
Bob: Great. Sarah, could you also confirm if we received the invoice for milestone 1?
Sarah: Yes, I already authorized it and payment should clear within 2 days.`,
      summary: 'Sync call regarding Stripe webhook 500 errors on staging environment. Sofia identified that the webhook signing secret is invalid. Bob proposed rotating the webhook secret in Stripe and updating the vault. Sofia will implement this today. Sarah confirmed milestone 1 invoice has been authorized for payment.',
      decisions: [
        'Rotate Stripe webhook signing secret in Stripe dashboard.',
        'Update staging Stripe webhook signing secret in Technology Vault today.',
      ],
      actions: [
        { text: 'Rotate Stripe webhook signing secret & update Technology Vault', date: new Date(Date.now()) },
        { text: 'Verify webhook responses in staging logs', date: new Date(Date.now() + 1 * 24 * 3600 * 1000) },
      ],
      sentiment: 'mixed',
    },
  ];

  for (let i = 0; i < projects.length; i++) {
    const proj = projects[i];
    const item = dispatchMockData[i % dispatchMockData.length];

    const entry = await prisma.dispatchEntry.create({
      data: {
        projectId: proj.id,
        createdById: owner.id,
        title: item.title,
        communicationType: item.type,
        source: 'manual',
        occurredAt: new Date(Date.now() - i * 2 * 24 * 3600 * 1000),
        rawContent: item.raw,
        aiSummary: item.summary,
        aiConfidence: 94,
        verificationStatus: i === 0 ? 'verified' : 'unverified',
        sentiment: item.sentiment,
        priority: i === 1 ? 'high' : 'normal',
      },
    });

    // Create participants
    await prisma.dispatchParticipant.createMany({
      data: [
        { dispatchEntryId: entry.id, participantType: 'user', userId: owner.id, displayName: owner.name },
        { dispatchEntryId: entry.id, participantType: 'user', userId: employee.id, displayName: employee.name },
        { dispatchEntryId: entry.id, participantType: 'client_contact', displayName: 'Client Contact John' },
      ],
    });

    // Create decisions
    await prisma.dispatchDecision.createMany({
      data: item.decisions.map(d => ({
        dispatchEntryId: entry.id,
        decisionText: d,
      })),
    });

    // Create action items
    for (const act of item.actions) {
      await prisma.dispatchActionItem.create({
        data: {
          dispatchEntryId: entry.id,
          actionText: act.text,
          dueDate: act.date,
          status: 'pending',
          assignedUserId: employee.id,
        },
      });
    }

    // Add tag
    await prisma.dispatchTag.create({
      data: {
        dispatchEntryId: entry.id,
        tag: 'milestone',
      },
    });
  }

  // 6. Seed Vault Field Access Requests
  console.log('Seeding vault field access requests...');
  for (let i = 0; i < 3; i++) {
    const proj = projects[i];
    const ca = createdAccounts[i % createdAccounts.length];
    const fields = await prisma.technologyAccountField.findMany({
      where: { technologyAccountId: ca.account.id, isSecret: true },
    });

    if (fields.length === 0) continue;

    const request = await prisma.vaultFieldAccessRequest.create({
      data: {
        technologyAccountId: ca.account.id,
        projectId: proj.id,
        requesterId: employee.id,
        status: i === 0 ? 'pending' : 'approved',
        urgency: i === 0 ? 'high' : 'normal',
        requestReason: `Need access to credentials for deploying and testing integration configs on project ${proj.name}.`,
        taskReference: `TASK-${1000 + i}`,
        requestedDurationMin: 120,
        requestedAt: new Date(Date.now() - i * 12 * 3600 * 1000),
      },
    });

    for (const f of fields) {
      await prisma.vaultRequestedField.create({
        data: {
          requestId: request.id,
          accountFieldId: f.id,
          approved: i !== 0,
        },
      });

      // If approved, create EmployeeCredentialGrant
      if (i !== 0) {
        await prisma.employeeCredentialGrant.create({
          data: {
            employeeId: employee.id,
            projectId: proj.id,
            technologyAccountId: ca.account.id,
            accountFieldId: f.id,
            approvedById: owner.id,
            requestId: request.id,
            active: true,
            canReveal: true,
            canCopy: false,
            singleUse: false,
            grantedAt: new Date(),
            expiresAt: new Date(Date.now() + 2 * 3600 * 1000), // 2 hours
          },
        });
      }
    }
  }

  // 7. Seed Notifications
  console.log('Seeding notifications...');
  await prisma.notification.createMany({
    data: [
      {
        userId: owner.id,
        type: 'credential_request',
        title: 'New Credential Access Request',
        message: `${employee.name} requested access to AWS console credentials for ${projects[0].name}.`,
        read: false,
      },
      {
        userId: owner.id,
        type: 'subscription_expiring',
        title: 'Subscription Renewal Alert',
        message: 'AWS Production Infrastructure subscription is renewal-due in 15 days.',
        read: false,
      },
      {
        userId: employee.id,
        type: 'credential_approved',
        title: 'Credential Access Granted',
        message: 'Your request for Stripe api_key access has been approved by Alice Owner.',
        read: false,
      },
    ],
  });

  console.log('Advanced seed complete successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
