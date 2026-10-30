-- AlterTable Profile : bio + avatarKey (pseudonyme déjà unique).
ALTER TABLE "Profile" ADD COLUMN "bio" TEXT;
ALTER TABLE "Profile" ADD COLUMN "avatarKey" TEXT;
