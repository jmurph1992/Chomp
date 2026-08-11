import { db, type User } from '@chomp/db'
import type { ModerationQueueEntryView } from '@chomp/types'
import { inngest } from '@/inngest/client'
import { deleteClerkUser, unbanClerkUser } from './clerk-admin'
import { findSoleOwnedTrucks, reactivateTrucks } from './user-erasure'

/**
 * The generic admin moderation queue — currently fed by exactly one trigger
 * (an erasure blocked by sole truck ownership), see
 * packages/db/prisma/schema.prisma's ModerationQueueEntry doc comment for why
 * the shape is deliberately generic rather than hardcoded to that one case.
 */

export async function getOpenModerationQueue(): Promise<ModerationQueueEntryView[]> {
  const entries = await db.moderationQueueEntry.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'asc' },
  })
  if (entries.length === 0) return []

  const allTruckIds = [...new Set(entries.flatMap((e) => e.blockingTruckIds))]
  const trucks = await db.truck.findMany({
    where: { id: { in: allTruckIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      // Who adminReassignTruckOwnerAction can hand the truck to — only an
      // existing manager is eligible, same constraint as the normal
      // offer/accept flow.
      operators: {
        where: { role: 'manager' },
        select: { user: { select: { id: true, email: true, displayName: true } } },
      },
    },
  })
  const truckById = new Map(
    trucks.map((t) => [
      t.id,
      {
        id: t.id,
        name: t.name,
        slug: t.slug,
        managers: t.operators.map((op) => ({
          userId: op.user.id,
          email: op.user.email,
          displayName: op.user.displayName,
        })),
      },
    ]),
  )

  const resolverIds = [...new Set(entries.map((e) => e.resolvedByUserId).filter((id) => id !== null))]
  const resolvers = await db.user.findMany({ where: { id: { in: resolverIds } }, select: { id: true, email: true } })
  const resolverEmailById = new Map(resolvers.map((r) => [r.id, r.email]))

  return entries.map((entry) => ({
    id: entry.id,
    reason: entry.reason,
    status: entry.status,
    subjectUserId: entry.subjectUserId,
    subjectEmail: entry.subjectEmail,
    subjectDisplayName: entry.subjectDisplayName,
    blockingTrucks: entry.blockingTruckIds.flatMap((id) => {
      const truck = truckById.get(id)
      return truck ? [truck] : []
    }),
    note: entry.note,
    createdAt: entry.createdAt.toISOString(),
    resolvedAt: entry.resolvedAt?.toISOString() ?? null,
    resolvedByEmail: entry.resolvedByUserId ? (resolverEmailById.get(entry.resolvedByUserId) ?? null) : null,
    resolutionNote: entry.resolutionNote,
  }))
}

/**
 * Opens a new blocked-erasure entry, or no-ops if an open one already exists
 * for this subject+reason — a re-delivered webhook or a resent Inngest event
 * must not spam the queue with duplicates.
 */
export async function openErasureBlockedEntry(
  user: Pick<User, 'id' | 'email' | 'displayName'>,
  blockingTrucks: { id: string; name: string }[],
  note: string,
): Promise<void> {
  const existing = await db.moderationQueueEntry.findFirst({
    where: { subjectUserId: user.id, reason: 'userErasureBlockedBySoleOwnership', status: 'open' },
  })
  if (existing) return

  await db.moderationQueueEntry.create({
    data: {
      reason: 'userErasureBlockedBySoleOwnership',
      subjectUserId: user.id,
      subjectEmail: user.email,
      subjectDisplayName: user.displayName,
      blockingTruckIds: blockingTrucks.map((t) => t.id),
      note,
    },
  })
}

/**
 * Completes a held erasure. Re-verifies findSoleOwnedTrucks live — never
 * trusts the entry's stored blockingTruckIds snapshot, which may be stale by
 * the time an admin acts on it. Throws (leaving the entry open) if the
 * subject still owns a truck.
 *
 * On success: marks the entry resolved, then attempts to complete the Clerk
 * deletion (handles the case where the account was only banned, not yet
 * deleted — a 404 here means it was already deleted directly, swallowed
 * rather than treated as failure), and always sends the erasure event
 * directly too, regardless of the Clerk call's outcome — belt-and-suspenders,
 * safe because eraseUserHandler is fully idempotent, and the only reliable
 * way to complete DB erasure when Clerk won't re-fire a webhook for an
 * account that was already gone before this resolution ran.
 */
export async function resolveModerationEntry(
  entryId: string,
  adminUserId: string,
  resolutionNote: string,
): Promise<void> {
  if (!resolutionNote.trim()) throw new Error('A resolution note is required')

  const entry = await db.moderationQueueEntry.findUnique({ where: { id: entryId } })
  if (!entry || entry.status !== 'open') throw new Error('Moderation entry not found or already resolved')
  if (!entry.subjectUserId) throw new Error('Subject has already been erased')

  const stillBlocking = await findSoleOwnedTrucks(entry.subjectUserId)
  if (stillBlocking.length > 0) {
    throw new Error(`Still blocked — still the sole owner of: ${stillBlocking.map((t) => t.name).join(', ')}`)
  }

  const subject = await db.user.findUnique({ where: { id: entry.subjectUserId } })
  if (!subject) throw new Error('Subject has already been erased')

  await db.moderationQueueEntry.update({
    where: { id: entryId },
    data: { status: 'resolved', resolvedByUserId: adminUserId, resolvedAt: new Date(), resolutionNote },
  })

  try {
    await deleteClerkUser(subject.clerkId)
  } catch {
    // Already deleted directly (Trigger B) — nothing more to do on Clerk's side.
  }
  await inngest.send({ name: 'app/user.deleted', data: { clerkId: subject.clerkId } })
}

/**
 * The opposite of resolveModerationEntry — an admin decides NOT to complete
 * the held erasure after all. Restores the subject entirely: reactivates
 * their trucks and unbans their Clerk account. No erasure is ever triggered
 * for this subject as a result of this entry.
 */
export async function dismissModerationEntry(
  entryId: string,
  adminUserId: string,
  resolutionNote: string,
): Promise<void> {
  if (!resolutionNote.trim()) throw new Error('A resolution note is required')

  const entry = await db.moderationQueueEntry.findUnique({ where: { id: entryId } })
  if (!entry || entry.status !== 'open') throw new Error('Moderation entry not found or already resolved')

  await reactivateTrucks(entry.blockingTruckIds)

  if (entry.subjectUserId) {
    const subject = await db.user.findUnique({ where: { id: entry.subjectUserId } })
    if (subject) await unbanClerkUser(subject.clerkId)
  }

  await db.moderationQueueEntry.update({
    where: { id: entryId },
    data: { status: 'dismissed', resolvedByUserId: adminUserId, resolvedAt: new Date(), resolutionNote },
  })
}
