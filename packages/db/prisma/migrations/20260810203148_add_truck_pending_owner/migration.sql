-- AlterTable
ALTER TABLE "trucks" ADD COLUMN     "pending_owner_id" TEXT;

-- AddForeignKey
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_pending_owner_id_fkey" FOREIGN KEY ("pending_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
