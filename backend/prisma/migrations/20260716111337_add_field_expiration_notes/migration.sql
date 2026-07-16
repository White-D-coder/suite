-- AlterTable
ALTER TABLE "TechnologyAccountField" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "isLifetime" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notes" TEXT;
