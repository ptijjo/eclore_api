-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'THEME_PROPOSAL';

-- CreateTable
CREATE TABLE "CommunityThemeProposal" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" "CommunityProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityThemeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityThemeProposal_communityId_status_createdAt_idx" ON "CommunityThemeProposal"("communityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityThemeProposal_proposerId_idx" ON "CommunityThemeProposal"("proposerId");

-- CreateIndex
CREATE INDEX "CommunityThemeProposal_status_createdAt_idx" ON "CommunityThemeProposal"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CommunityThemeProposal" ADD CONSTRAINT "CommunityThemeProposal_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityThemeProposal" ADD CONSTRAINT "CommunityThemeProposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
