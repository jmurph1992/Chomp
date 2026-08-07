-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'cancelled', 'expired');

-- CreateTable
CREATE TABLE "truck_invites" (
    "id" TEXT NOT NULL,
    "truck_id" TEXT NOT NULL,
    "invited_email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "accepted_by_user_id" TEXT,

    CONSTRAINT "truck_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "truck_invites_token_key" ON "truck_invites"("token");

-- CreateIndex
CREATE INDEX "truck_invites_truck_id_status_idx" ON "truck_invites"("truck_id", "status");

-- AddForeignKey
ALTER TABLE "truck_invites" ADD CONSTRAINT "truck_invites_truck_id_fkey" FOREIGN KEY ("truck_id") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_invites" ADD CONSTRAINT "truck_invites_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_invites" ADD CONSTRAINT "truck_invites_accepted_by_user_id_fkey" FOREIGN KEY ("accepted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
