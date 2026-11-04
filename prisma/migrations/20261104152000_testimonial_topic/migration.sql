-- AlterTable
ALTER TABLE "Testimonial" ADD COLUMN "topic" TEXT;

-- CreateIndex
CREATE INDEX "Testimonial_communityId_status_topic_idx" ON "Testimonial"("communityId", "status", "topic");
