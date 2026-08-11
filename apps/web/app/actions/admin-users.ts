'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin'
import { banClerkUser, deleteClerkUser } from '@/lib/clerk-admin'
import { adminReassignTruckOwner } from '@/lib/invites'
import { dismissModerationEntry, openErasureBlockedEntry, resolveModerationEntry } from '@/lib/moderation-queue'
import { deleteTruck } from '@/lib/trucks'
import { deactivateTrucks, findSoleOwnedTrucks } from '@/lib/user-erasure'
import { getUserById } from '@/lib/users'

/**
 * Deletes a user's account, or blocks and queues it for moderation if they're
 * the sole owner of at least one truck (see lib/user-erasure.ts and
 * lib/moderation-queue.ts). Admin accounts can't be targeted through this
 * path at all — role is only ever set via direct DB access, same out-of-band
 * posture removal should follow too.
 *
 * A successful, non-blocked call only deletes the account in Clerk — the
 * actual DB erasure happens asynchronously afterward via the user.deleted
 * webhook, same as deleteOwnAccountAction (app/actions/account.ts). This
 * keeps exactly one code path (the Inngest job) ever performing erasure,
 * regardless of what triggered it.
 */
export async function deleteUserAction(
  userId: string,
  confirmedEmail: string,
): Promise<{ blocked: boolean }> {
  const admin = await requireAdmin()
  const target = await getUserById(userId)
  if (!target) throw new Error('User not found')
  if (target.role === 'admin') throw new Error('Admin accounts cannot be deleted through this tool')
  if (confirmedEmail.trim().toLowerCase() !== target.email.toLowerCase()) {
    throw new Error('Email does not match — deletion cancelled')
  }

  const blockingTrucks = await findSoleOwnedTrucks(target.id)
  if (blockingTrucks.length > 0) {
    await deactivateTrucks(blockingTrucks.map((t) => t.id))
    await banClerkUser(target.clerkId)
    await openErasureBlockedEntry(target, blockingTrucks, `Blocked by admin ${admin.email}`)
    revalidatePath('/admin/users')
    revalidatePath('/admin/moderation')
    return { blocked: true }
  }

  await deleteClerkUser(target.clerkId)
  revalidatePath('/admin/users')
  return { blocked: false }
}

export async function resolveModerationEntryAction(entryId: string, resolutionNote: string): Promise<void> {
  const admin = await requireAdmin()
  await resolveModerationEntry(entryId, admin.id, resolutionNote)
  revalidatePath('/admin/moderation')
  revalidatePath('/admin/users')
}

export async function dismissModerationEntryAction(entryId: string, resolutionNote: string): Promise<void> {
  const admin = await requireAdmin()
  await dismissModerationEntry(entryId, admin.id, resolutionNote)
  revalidatePath('/admin/moderation')
  revalidatePath('/')
}

/** Admin-only wrapper around the unchanged deleteTruck — for a truck whose owner is banned/held and can't invoke the normal owner-only action. */
export async function adminDeleteTruckAction(truckId: string, confirmedName: string): Promise<void> {
  await requireAdmin()
  await deleteTruck(truckId, confirmedName)
  revalidatePath('/admin/moderation')
  revalidatePath('/')
}

/** Admin-only wrapper around adminReassignTruckOwner — the moderation-queue escape hatch for a truck whose owner can't invoke the normal offer/accept flow. */
export async function adminReassignTruckOwnerAction(truckId: string, newOwnerUserId: string): Promise<void> {
  await requireAdmin()
  await adminReassignTruckOwner(truckId, newOwnerUserId)
  revalidatePath('/admin/moderation')
}
