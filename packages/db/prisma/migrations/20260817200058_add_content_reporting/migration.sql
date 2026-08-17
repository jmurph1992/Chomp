-- CreateEnum
CREATE TYPE "ContentReportReason" AS ENUM ('spam', 'inappropriate', 'harassment', 'other');

-- CreateEnum
CREATE TYPE "ContentReportStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- AlterTable
ALTER TABLE "review_photos" ADD COLUMN     "moderated_at" TIMESTAMP(3),
ADD COLUMN     "moderated_by_user_id" TEXT,
ADD COLUMN     "moderation_note" TEXT;

-- CreateTable
CREATE TABLE "content_reports" (
    "id" TEXT NOT NULL,
    "review_id" TEXT,
    "review_photo_id" TEXT,
    "reporter_user_id" TEXT,
    "reason" "ContentReportReason" NOT NULL,
    "note" TEXT,
    "status" "ContentReportStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "resolution_note" TEXT,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_reports_status_idx" ON "content_reports"("status");

-- AddForeignKey
ALTER TABLE "review_photos" ADD CONSTRAINT "review_photos_moderated_by_user_id_fkey" FOREIGN KEY ("moderated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_review_photo_id_fkey" FOREIGN KEY ("review_photo_id") REFERENCES "review_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
