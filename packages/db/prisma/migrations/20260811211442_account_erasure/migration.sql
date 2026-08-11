-- CreateEnum
CREATE TYPE "ModerationQueueReason" AS ENUM ('userErasureBlockedBySoleOwnership');

-- CreateEnum
CREATE TYPE "ModerationQueueStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ErasureTrigger" AS ENUM ('direct', 'resolvedFromModerationQueue');

-- DropForeignKey
ALTER TABLE "photo_likes" DROP CONSTRAINT "photo_likes_user_id_fkey";

-- DropForeignKey
ALTER TABLE "review_photos" DROP CONSTRAINT "review_photos_user_id_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_user_id_fkey";

-- DropForeignKey
ALTER TABLE "truck_invites" DROP CONSTRAINT "truck_invites_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "truck_operators" DROP CONSTRAINT "truck_operators_user_id_fkey";

-- AlterTable
ALTER TABLE "review_photos" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "reviews" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "truck_invites" ALTER COLUMN "created_by_user_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "moderation_queue_entries" (
    "id" TEXT NOT NULL,
    "reason" "ModerationQueueReason" NOT NULL,
    "status" "ModerationQueueStatus" NOT NULL DEFAULT 'open',
    "subject_user_id" TEXT,
    "subject_email" TEXT NOT NULL,
    "subject_display_name" TEXT,
    "blocking_truck_ids" TEXT[],
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "resolution_note" TEXT,

    CONSTRAINT "moderation_queue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erasure_records" (
    "id" TEXT NOT NULL,
    "email_hash" TEXT NOT NULL,
    "trigger" "ErasureTrigger" NOT NULL,
    "moderation_queue_entry_id" TEXT,
    "erased_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erasure_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_queue_entries_status_reason_idx" ON "moderation_queue_entries"("status", "reason");

-- AddForeignKey
ALTER TABLE "truck_operators" ADD CONSTRAINT "truck_operators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_invites" ADD CONSTRAINT "truck_invites_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_photos" ADD CONSTRAINT "review_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_likes" ADD CONSTRAINT "photo_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_queue_entries" ADD CONSTRAINT "moderation_queue_entries_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_queue_entries" ADD CONSTRAINT "moderation_queue_entries_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erasure_records" ADD CONSTRAINT "erasure_records_moderation_queue_entry_id_fkey" FOREIGN KEY ("moderation_queue_entry_id") REFERENCES "moderation_queue_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
