-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "moderated_at" TIMESTAMP(3),
ADD COLUMN     "moderated_by_user_id" TEXT,
ADD COLUMN     "moderation_note" TEXT;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_user_id_fkey" FOREIGN KEY ("moderated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
