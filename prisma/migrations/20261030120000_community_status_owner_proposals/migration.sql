-- CreateEnum
CREATE TYPE "CommunityStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommunityProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'DISMISSED');

-- AlterEnum MembershipRole : OWNER en tête (valeur ajoutée)
ALTER TYPE "MembershipRole" ADD VALUE 'OWNER';

-- AlterTable Community
ALTER TABLE "Community" ADD COLUMN "status" "CommunityStatus" NOT NULL DEFAULT 'DRAFT';

-- Communautés déjà en base : les rendre actives (catalogue existant).
UPDATE "Community" SET "status" = 'ACTIVE';

-- CreateTable CommunityProposal
CREATE TABLE "CommunityProposal" (
    "id" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" "CommunityProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityProposal_status_createdAt_idx" ON "CommunityProposal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityProposal_proposerId_idx" ON "CommunityProposal"("proposerId");

-- AddForeignKey
ALTER TABLE "CommunityProposal" ADD CONSTRAINT "CommunityProposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
