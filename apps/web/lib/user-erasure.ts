import { createHash } from 'node:crypto'
import { db } from '@chomp/db'

export type SoleOwnedTruck = { id: string; name: string; slug: string }

function isRecordNotFoundError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2025'
}

function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

/** Resolves a user by their Clerk id — the Clerk webhook only ever gives us that. */
export async function findUserByClerkId(clerkId: string) {
  return db.user.findUnique({ where: { clerkId } })
}

/**
 * Every truck this user owns. Truck.ownerId is a single required field — a
 * truck has exactly one owner by schema design, so "sole owner" and "owner"
 * are the same check here. The "sole" framing matters for what it implies
 * (nobody else can consent to taking over automatically), not a multiplicity
 * check.
 */
export async function findSoleOwnedTrucks(userId: string): Promise<SoleOwnedTruck[]> {
  return db.truck.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  })
}

/** Pulls trucks off the map/public pages without deleting them — same field truck verification already uses to hold a truck. */
export async function deactivateTrucks(truckIds: string[]): Promise<void> {
  if (truckIds.length === 0) return
  await db.truck.updateMany({ where: { id: { in: truckIds } }, data: { isActive: false } })
}

/** Restores trucks a moderation-queue hold deactivated — used when an entry is dismissed instead of resolved. */
export async function reactivateTrucks(truckIds: string[]): Promise<void> {
  if (truckIds.length === 0) return
  await db.truck.updateMany({ where: { id: { in: truckIds } }, data: { isActive: true } })
}

/**
 * Actually erases a user, once it's established they own nothing — callers
 * (the Inngest job, lib/moderation-queue.ts#resolveModerationEntry) must run
 * findSoleOwnedTrucks first; this function trusts that check already passed
 * rather than re-running it itself, keeping the transaction below focused on
 * the atomic delete-and-record write.
 *
 * Deletion cascades/orphans per the schema (packages/db/prisma/schema.prisma):
 * Review/ReviewPhoto.userId -> SetNull (anonymized, stays visible),
 * TruckOperator/PhotoLike -> Cascade (purely personal, removed — but see
 * lib/review-photos.ts#removeAllPhotoLikesForUser, which callers must run
 * *before* this to keep ReviewPhoto.likesCount correct, since a raw cascade
 * removes PhotoLike rows without decrementing the counter),
 * TruckInvite.createdByUserId/Review.moderatedByUserId -> SetNull (audit
 * trail keeps the fact, loses the name). No per-model application code is
 * needed for any of that — same as lib/trucks.ts#deleteTruck's single
 * db.truck.delete() already relies on cascades for its child tables.
 *
 * trigger is classified deterministically from durable DB state (was there a
 * resolved ModerationQueueEntry for this subject), not from which caller's
 * event happened to arrive first — self-service deletion, an admin's
 * non-blocked deletion, and the webhook's own send can all fire
 * near-simultaneously, so tagging the event itself would be racy.
 *
 * Idempotent: a retried/duplicate call for an already-erased user is a
 * no-op, not an error (Prisma P2025 — record not found — is swallowed).
 */
export async function eraseUserRow(user: { id: string; email: string }): Promise<void> {
  const resolvedEntry = await db.moderationQueueEntry.findFirst({
    where: { subjectUserId: user.id, status: 'resolved' },
    orderBy: { resolvedAt: 'desc' },
  })

  try {
    await db.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: user.id } })
      await tx.erasureRecord.create({
        data: {
          emailHash: hashEmail(user.email),
          trigger: resolvedEntry ? 'resolvedFromModerationQueue' : 'direct',
          moderationQueueEntryId: resolvedEntry?.id ?? null,
        },
      })
    })
  } catch (err) {
    if (isRecordNotFoundError(err)) return // already erased — a retried/duplicate event
    throw err
  }
}
