-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Internal User',
    "role" TEXT NOT NULL DEFAULT 'employee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV-',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "currency" TEXT,
    "billingAddress" TEXT,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "primaryNumber" TEXT,
    "relationshipLabel" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "preferredForBilling" BOOLEAN NOT NULL DEFAULT false,
    "preferredForUrgent" BOOLEAN NOT NULL DEFAULT false,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "consentStatus" TEXT NOT NULL DEFAULT 'granted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactChannel" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "phoneType" TEXT NOT NULL,
    "numberOrAddress" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "githubRepoUrl" TEXT,
    "liveUrl" TEXT,
    "stagingUrl" TEXT,
    "techStack" TEXT[],
    "hostingPlatform" TEXT,
    "databasePlatform" TEXT,
    "deploymentPlatform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "country" TEXT,
    "state" TEXT,
    "projectCategory" TEXT,
    "serviceType" TEXT,
    "contractStatus" TEXT NOT NULL DEFAULT 'active',
    "progressStatus" TEXT NOT NULL DEFAULT 'scoping',
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectContract" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contractStatus" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "billingModel" TEXT NOT NULL,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAccount" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "env" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectToolSubscription" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "renewalDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectToolSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectProgressUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "updaterId" TEXT NOT NULL,
    "updateText" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectProgressUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEnvironment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roleOnProject" TEXT,
    "accessLevel" TEXT NOT NULL DEFAULT 'view',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "extendedTo" TIMESTAMP(3),
    "extensionHistory" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultCollection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT,
    "rotationPolicy" TEXT,
    "lastRotationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultSecret" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "secretType" TEXT NOT NULL,
    "username" TEXT,
    "encryptedValue" TEXT NOT NULL,
    "tool" TEXT,
    "environment" TEXT,
    "owner" TEXT,
    "revealPolicy" TEXT NOT NULL DEFAULT 'owner_admin_approved',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultSecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultSecretVersion" (
    "id" TEXT NOT NULL,
    "secretId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultSecretVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "secretScope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approverId" TEXT,
    "approvalTimestamp" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationTask" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "snoozedUntil" TIMESTAMP(3),
    "reason" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assignedTo" TEXT,
    "deadline" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" TEXT NOT NULL DEFAULT 'outgoing',

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Template',
    "htmlContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progressBillingMode" TEXT,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "remainingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "clientCurrency" TEXT,
    "displayCurrency" TEXT,
    "fxRate" DECIMAL(10,4),
    "fxSource" TEXT,
    "fxTimestamp" TIMESTAMP(3),
    "fxMode" TEXT NOT NULL DEFAULT 'frozen',
    "taxProfile" TEXT,
    "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalPayableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountStatus" TEXT,
    "discountCalcOrder" TEXT NOT NULL DEFAULT 'before_tax',

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSchedule" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "milestoneName" TEXT NOT NULL,
    "percentage" DECIMAL(5,2),
    "amountDue" DECIMAL(12,2) NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3),
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "paidAt" TIMESTAMP(3),
    "reminderPolicy" TEXT NOT NULL DEFAULT 'on_due_date',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "invoiceId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    "paymentMethod" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "taxMode" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recurrence" TEXT,
    "vendor" TEXT,
    "projectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "dueDate" TIMESTAMP(3),
    "reminderDays" INTEGER NOT NULL DEFAULT 7,
    "taxAmount" DECIMAL(12,2),
    "taxProfile" TEXT,
    "receiptAttachment" TEXT,
    "ownerUserId" TEXT,
    "postponedUntil" TIMESTAMP(3),
    "postponeReason" TEXT,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "renewalDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" TEXT,
    "reminderDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "benefits" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "payPeriod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitabilitySnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "directCost" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "indirectCost" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "margin" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "status" TEXT NOT NULL DEFAULT 'healthy',
    "apportionmentLog" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitabilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteMonitor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastStatus" TEXT,
    "sslExpiryDate" TIMESTAMP(3),
    "domainExpiryDate" TIMESTAMP(3),
    "hostingExpiryDate" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "WebsiteMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceDiscount" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceItemId" TEXT,
    "discountType" TEXT NOT NULL,
    "discountScope" TEXT NOT NULL,
    "discountValue" DECIMAL(12,4) NOT NULL,
    "calculatedAmount" DECIMAL(12,2) NOT NULL,
    "purposeCode" TEXT NOT NULL,
    "purposeNote" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'approved',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnologyCatalogue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "category" TEXT NOT NULL,
    "logoUrl" TEXT,
    "officialUrl" TEXT,
    "supportsSubscription" BOOLEAN NOT NULL DEFAULT false,
    "supportsEnvironments" BOOLEAN NOT NULL DEFAULT true,
    "supportsOAuth" BOOLEAN NOT NULL DEFAULT false,
    "supportsRotation" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnologyCatalogue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnologyFieldDefinition" (
    "id" TEXT NOT NULL,
    "technologyId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isRepeatable" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnologyFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnologyAccount" (
    "id" TEXT NOT NULL,
    "technologyId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountIdentifier" TEXT,
    "ownerType" TEXT NOT NULL DEFAULT 'agency',
    "ownerUserId" TEXT,
    "clientId" TEXT,
    "subscriptionPlan" TEXT,
    "billingCycle" TEXT,
    "billingAmount" DECIMAL(12,2),
    "billingCurrency" TEXT,
    "nextBillingDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "autoRenewal" BOOLEAN NOT NULL DEFAULT false,
    "isLifetime" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
    "reminderDays" INTEGER[] DEFAULT ARRAY[30, 7, 1]::INTEGER[],
    "lastRotationDate" TIMESTAMP(3),
    "nextRotationDate" TIMESTAMP(3),
    "rotationPolicy" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnologyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTechnologyLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "technologyAccountId" TEXT NOT NULL,
    "connectionType" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTechnologyLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnologyEnvironment" (
    "id" TEXT NOT NULL,
    "technologyAccountId" TEXT NOT NULL,
    "environmentName" TEXT NOT NULL,
    "environmentType" TEXT NOT NULL,
    "url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnologyEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnologyAccountField" (
    "id" TEXT NOT NULL,
    "technologyAccountId" TEXT NOT NULL,
    "environmentId" TEXT,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "encryptedValue" TEXT,
    "nonSecretValue" TEXT,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnologyAccountField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultFieldAccessRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "technologyAccountId" TEXT NOT NULL,
    "environmentId" TEXT,
    "requestReason" TEXT NOT NULL,
    "taskReference" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "requestedDurationMin" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectedReason" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "VaultFieldAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultRequestedField" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "accountFieldId" TEXT NOT NULL,
    "requested" BOOLEAN NOT NULL DEFAULT true,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "canReveal" BOOLEAN NOT NULL DEFAULT false,
    "canCopy" BOOLEAN NOT NULL DEFAULT false,
    "singleUse" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "VaultRequestedField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCredentialGrant" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "technologyAccountId" TEXT NOT NULL,
    "accountFieldId" TEXT NOT NULL,
    "environmentId" TEXT,
    "requestId" TEXT,
    "approvedById" TEXT NOT NULL,
    "canReveal" BOOLEAN NOT NULL DEFAULT true,
    "canCopy" BOOLEAN NOT NULL DEFAULT false,
    "singleUse" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),

    CONSTRAINT "EmployeeCredentialGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clientId" TEXT,
    "communicationType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "rawContent" TEXT,
    "aiSummary" TEXT,
    "aiConfidence" DECIMAL(5,2),
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "sentiment" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "followUpAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchParticipant" (
    "id" TEXT NOT NULL,
    "dispatchEntryId" TEXT NOT NULL,
    "participantType" TEXT NOT NULL,
    "userId" TEXT,
    "clientContactId" TEXT,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "DispatchParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchDecision" (
    "id" TEXT NOT NULL,
    "dispatchEntryId" TEXT NOT NULL,
    "decisionText" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DispatchDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchActionItem" (
    "id" TEXT NOT NULL,
    "dispatchEntryId" TEXT NOT NULL,
    "actionText" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "linkedTaskId" TEXT,

    CONSTRAINT "DispatchActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchTag" (
    "id" TEXT NOT NULL,
    "dispatchEntryId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "DispatchTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySetting_userId_key" ON "CompanySetting"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProfitabilitySnapshot_projectId_key" ON "ProfitabilitySnapshot"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnologyCatalogue_name_key" ON "TechnologyCatalogue"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTechnologyLink_projectId_technologyAccountId_key" ON "ProjectTechnologyLink"("projectId", "technologyAccountId");

-- AddForeignKey
ALTER TABLE "CompanySetting" ADD CONSTRAINT "CompanySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactChannel" ADD CONSTRAINT "ContactChannel_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectContract" ADD CONSTRAINT "ProjectContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAccount" ADD CONSTRAINT "ProjectAccount_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectToolSubscription" ADD CONSTRAINT "ProjectToolSubscription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProgressUpdate" ADD CONSTRAINT "ProjectProgressUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEnvironment" ADD CONSTRAINT "ProjectEnvironment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultCollection" ADD CONSTRAINT "VaultCollection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultSecret" ADD CONSTRAINT "VaultSecret_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "VaultCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultSecretVersion" ADD CONSTRAINT "VaultSecretVersion_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "VaultSecret"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationTask" ADD CONSTRAINT "RotationTask_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "VaultCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceSchedule" ADD CONSTRAINT "InvoiceSchedule_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRecord" ADD CONSTRAINT "SalaryRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitabilitySnapshot" ADD CONSTRAINT "ProfitabilitySnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteMonitor" ADD CONSTRAINT "WebsiteMonitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDiscount" ADD CONSTRAINT "InvoiceDiscount_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyFieldDefinition" ADD CONSTRAINT "TechnologyFieldDefinition_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "TechnologyCatalogue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyAccount" ADD CONSTRAINT "TechnologyAccount_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "TechnologyCatalogue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTechnologyLink" ADD CONSTRAINT "ProjectTechnologyLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTechnologyLink" ADD CONSTRAINT "ProjectTechnologyLink_technologyAccountId_fkey" FOREIGN KEY ("technologyAccountId") REFERENCES "TechnologyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyEnvironment" ADD CONSTRAINT "TechnologyEnvironment_technologyAccountId_fkey" FOREIGN KEY ("technologyAccountId") REFERENCES "TechnologyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyAccountField" ADD CONSTRAINT "TechnologyAccountField_technologyAccountId_fkey" FOREIGN KEY ("technologyAccountId") REFERENCES "TechnologyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnologyAccountField" ADD CONSTRAINT "TechnologyAccountField_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TechnologyEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultFieldAccessRequest" ADD CONSTRAINT "VaultFieldAccessRequest_technologyAccountId_fkey" FOREIGN KEY ("technologyAccountId") REFERENCES "TechnologyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultRequestedField" ADD CONSTRAINT "VaultRequestedField_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VaultFieldAccessRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultRequestedField" ADD CONSTRAINT "VaultRequestedField_accountFieldId_fkey" FOREIGN KEY ("accountFieldId") REFERENCES "TechnologyAccountField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCredentialGrant" ADD CONSTRAINT "EmployeeCredentialGrant_accountFieldId_fkey" FOREIGN KEY ("accountFieldId") REFERENCES "TechnologyAccountField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCredentialGrant" ADD CONSTRAINT "EmployeeCredentialGrant_technologyAccountId_fkey" FOREIGN KEY ("technologyAccountId") REFERENCES "TechnologyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchEntry" ADD CONSTRAINT "DispatchEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchParticipant" ADD CONSTRAINT "DispatchParticipant_dispatchEntryId_fkey" FOREIGN KEY ("dispatchEntryId") REFERENCES "DispatchEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchDecision" ADD CONSTRAINT "DispatchDecision_dispatchEntryId_fkey" FOREIGN KEY ("dispatchEntryId") REFERENCES "DispatchEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchActionItem" ADD CONSTRAINT "DispatchActionItem_dispatchEntryId_fkey" FOREIGN KEY ("dispatchEntryId") REFERENCES "DispatchEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchTag" ADD CONSTRAINT "DispatchTag_dispatchEntryId_fkey" FOREIGN KEY ("dispatchEntryId") REFERENCES "DispatchEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
