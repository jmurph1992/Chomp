'use server'

import { getCurrentUser } from '@/lib/auth'
import { deleteClerkUser } from '@/lib/clerk-admin'
import { findSoleOwnedTrucks } from '@/lib/user-erasure'

/**
 * Deletes the signed-in user's own account. Never accepts a target userId —
 * operates only on getCurrentUser()'s own id, which eliminates any IDOR
 * surface for this action by construction rather than needing the
 * scoped-updateMany idiom every other mutation in this app uses.
 *
 * Only deletes the account in Clerk — the actual DB erasure happens
 * asynchronously afterward via the user.deleted webhook, same as
 * deleteUserAction (app/actions/admin-users.ts). No redirect() here — the
 * caller's Clerk session is invalid the moment this resolves, so the client
 * navigates away itself rather than this action attempting to.
 */
export async function deleteOwnAccountAction(confirmedEmail: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')
  if (confirmedEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new Error('Email does not match — deletion cancelled')
  }

  const blockingTrucks = await findSoleOwnedTrucks(user.id)
  if (blockingTrucks.length > 0) {
    throw new Error(
      `You're the sole owner of ${blockingTrucks.map((t) => t.name).join(', ')} — transfer ownership or delete it first.`,
    )
  }

  await deleteClerkUser(user.clerkId)
}
