-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CONTENT_REPORT';

-- AlterTable Report — détails + snapshot modération
ALTER TABLE "Report" ADD COLUMN "details" TEXT;
ALTER TABLE "Report" ADD COLUMN "reporterIp" TEXT;
ALTER TABLE "Report" ADD COLUMN "reporterEmail" TEXT;
ALTER TABLE "Report" ADD COLUMN "reporterPseudonym" TEXT;
ALTER TABLE "Report" ADD COLUMN "targetAuthorId" TEXT;
ALTER TABLE "Report" ADD COLUMN "targetAuthorEmail" TEXT;
ALTER TABLE "Report" ADD COLUMN "targetAuthorPseudonym" TEXT;
ALTER TABLE "Report" ADD COLUMN "targetAuthorIp" TEXT;
ALTER TABLE "Report" ADD COLUMN "targetPreview" TEXT;
ALTER TABLE "Report" ADD COLUMN "targetCreatedAt" TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN "targetPublishedAt" TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN "communityId" TEXT;
ALTER TABLE "Report" ADD COLUMN "communityName" TEXT;

-- CreateIndex
CREATE INDEX "Report_reporterId_status_idx" ON "Report"("reporterId", "status");

-- AlterTable ModerationAction — sujet de la sanction
ALTER TABLE "ModerationAction" ADD COLUMN "subjectUserId" TEXT;

-- CreateIndex
CREATE INDEX "ModerationAction_subjectUserId_idx" ON "ModerationAction"("subjectUserId");

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
