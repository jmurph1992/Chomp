'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import {
  cancelInvite,
  claimInvite,
  createInvite,
  removeManager,
} from '@/lib/invites'
import { requireOperator } from '@/lib/operators'
import { checkRateLimit, inviteLimiter } from '@/lib/rate-limit'
import type { TruckInviteView } from '@chomp/types'

/**
 * Owner-only guard, shared by every mutation below — requireOperator alone
 * only proves the caller manages this specific truck, not that they're
 * specifically its owner. Managers can view the team page but not invite,
 * cancel, or remove.
 */
async function requireOwner(truckId: string) {
  const { user, role } = await requireOperator(truckId)
  if (role !== 'owner') throw new Error('Only the truck owner can do this')
  return user
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export async function createInviteAction(
  truckId: string,
  invitedEmail: string,
): Promise<TruckInviteView & { url: string }> {
  const user = await requireOwner(truckId)
  await checkRateLimit(inviteLimiter, user.id)

  const invite = await createInvite(truckId, user.id, invitedEmail)
  revalidatePath(`/dashboard/${truckId}/team`)

  return { ...invite, url: `${appUrl()}/invite/${invite.token}` }
}

export async function cancelInviteAction(truckId: string, inviteId: string): Promise<void> {
  await requireOwner(truckId)
  await cancelInvite(truckId, inviteId)
  revalidatePath(`/dashboard/${truckId}/team`)
}

export async function removeManagerAction(truckId: string, managerUserId: string): Promise<void> {
  const user = await requireOwner(truckId)
  await removeManager(truckId, managerUserId, user.id)
  revalidatePath(`/dashboard/${truckId}/team`)
}

/**
 * Different auth shape from every action above: no truckId (the claimant
 * doesn't know it yet) and no requireOperator (the claimant isn't an
 * operator yet — that's the entire point of this action).
 */
export async function claimInviteAction(token: string): Promise<{ truckId: string }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')

  const result = await claimInvite(token, user)
  revalidatePath('/dashboard')
  return result
}
