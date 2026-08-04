-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'verified', 'rejected', 'onHold');

-- AlterTable: add the new status/note columns, backfill from the old boolean,
-- then drop it. Existing is_verified = true rows become 'verified'; everything
-- else (including all current false rows) becomes the default 'pending' — there's
-- no way to recover a "was rejected" history from a boolean, and there doesn't
-- need to be, since no real user-facing rejections have happened yet.
ALTER TABLE "trucks" ADD COLUMN "verification_status" "VerificationStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "trucks" ADD COLUMN "verification_note" TEXT;

UPDATE "trucks" SET "verification_status" = 'verified' WHERE "is_verified" = true;

ALTER TABLE "trucks" DROP COLUMN "is_verified";
