-- AlterTable Testimonial : choix auteur d’autoriser ou non les commentaires.
ALTER TABLE "Testimonial" ADD COLUMN "commentsEnabled" BOOLEAN NOT NULL DEFAULT true;
