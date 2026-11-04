-- CreateEnum
CREATE TYPE "SupportReactionKind" AS ENUM ('I_UNDERSTAND', 'COURAGE', 'I_READ_YOU', 'NOT_ALONE', 'THANK_YOU_TRUST');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SUPPORT_REACTION';

-- CreateTable
CREATE TABLE "TestimonialSupportReaction" (
    "id" TEXT NOT NULL,
    "testimonialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "SupportReactionKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestimonialSupportReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestimonialSupportReaction_testimonialId_kind_idx" ON "TestimonialSupportReaction"("testimonialId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "TestimonialSupportReaction_testimonialId_userId_key" ON "TestimonialSupportReaction"("testimonialId", "userId");

-- AddForeignKey
ALTER TABLE "TestimonialSupportReaction" ADD CONSTRAINT "TestimonialSupportReaction_testimonialId_fkey" FOREIGN KEY ("testimonialId") REFERENCES "Testimonial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestimonialSupportReaction" ADD CONSTRAINT "TestimonialSupportReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
