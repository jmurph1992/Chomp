import { randomUUID } from 'node:crypto'
import { db, type User } from '@chomp/db'
import type { InvitePreview, TruckInviteView, TruckManagerView } from '@chomp/types'

const INVITE_EXPIRY_DAYS = 7

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim()
  return trimmed.length > 0 && trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function expiryDate(): Date {
  return new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
}

type InviteRow = {
  id: string
  invitedEmail: string
  token: string
  status: 'pending' | 'accepted' | 'cancelled' | 'expired'
  createdAt: Date
  expiresAt: Date
}

function toInviteView(invite: InviteRow): TruckInviteView {
  return {
    id: invite.id,
    invitedEmail: invite.invitedEmail,
    token: invite.token,
    status: invite.status,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
  }
}

/**
 * Creates a manager invite, or reuses an existing live pending one for the
 * same (truckId, email) instead of minting a duplicate link — an owner
 * re-clicking "invite" for the same person shouldn't produce two live
 * offers. A stale pending invite past its expiry is flipped to `expired`
 * and replaced rather than reused.
 */
export async function createInvite(
  truckId: string,
  invitedByUserId: string,
  rawEmail: string,
): Promise<TruckInviteView> {
  if (!isValidEmail(rawEmail)) throw new Error('Invalid email address')
  const invitedEmail = normalizeEmail(rawEmail)

  const existingOperator = await db.truckOperator.findFirst({
    where: { truckId, user: { email: invitedEmail } },
  })
  if (existingOperator) throw new Error('This person is already on the team')

  const existing = await db.truckInvite.findFirst({
    where: { truckId, invitedEmail, status: 'pending' },
  })
  if (existing) {
    if (existing.expiresAt > new Date()) return toInviteView(existing)
    await db.truckInvite.update({ where: { id: existing.id }, data: { status: 'expired' } })
  }

  const invite = await db.truckInvite.create({
    data: {
      truckId,
      invitedEmail,
      token: randomUUID(),
      createdByUserId: invitedByUserId,
      expiresAt: expiryDate(),
    },
  })
  return toInviteView(invite)
}

/** Pending + recently-resolved invites for a truck's team page, scoped strictly by truckId. */
export async function listInvitesForTruck(truckId: string): Promise<TruckInviteView[]> {
  const invites = await db.truckInvite.findMany({
    where: { truckId },
    orderBy: { createdAt: 'desc' },
  })
  return invites.map(toInviteView)
}

/**
 * Revokes a pending invite before it's claimed. Scoped by both id and
 * truckId (updateMany, not a plain unique update) so an owner of truck A
 * can't cancel an invite belonging to truck B by guessing its id — same
 * IDOR-prevention idiom as lib/menu.ts / lib/schedule.ts.
 */
export async function cancelInvite(truckId: string, inviteId: string): Promise<void> {
  const result = await db.truckInvite.updateMany({
    where: { id: inviteId, truckId, status: 'pending' },
    data: { status: 'cancelled' },
  })
  if (result.count === 0) throw new Error('Invite not found')
}

/** Unauthenticated-safe preview for the claim landing page — never includes invitedEmail. */
export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  const invite = await db.truckInvite.findUnique({
    where: { token },
    include: { truck: { select: { name: true } } },
  })
  if (!invite) return null

  return {
    truckName: invite.truck.name,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
  }
}

/**
 * Validates and claims an invite for the signed-in user. Pre-checks (not
 * found, wrong status, expired, email mismatch) run as plain reads/single
 * writes — only the actual grant (TruckOperator creation + marking the
 * invite accepted) needs to be atomic, so that's the only part wrapped in a
 * transaction. A crash between the two writes there would otherwise leave a
 * manager row with no corresponding "accepted" invite, or vice versa.
 */
export async function claimInvite(
  token: string,
  claimingUser: Pick<User, 'id' | 'email' | 'role'>,
): Promise<{ truckId: string }> {
  const invite = await db.truckInvite.findUnique({ where: { token } })
  if (!invite) throw new Error('Invite not found or already used')

  if (invite.status === 'accepted') throw new Error('This invite has already been accepted')
  if (invite.status === 'cancelled') throw new Error('This invite was cancelled')
  if (invite.status === 'expired') throw new Error('This invite has expired')

  if (invite.expiresAt < new Date()) {
    await db.truckInvite.update({ where: { id: invite.id }, data: { status: 'expired' } })
    throw new Error('This invite has expired')
  }

  if (invite.invitedEmail !== normalizeEmail(claimingUser.email)) {
    throw new Error('This invite was sent to a different email address')
  }

  await db.$transaction(async (tx) => {
    const existingOperator = await tx.truckOperator.findUnique({
      where: { truckId_userId: { truckId: invite.truckId, userId: claimingUser.id } },
    })
    // Already a team member some other way (e.g. double-submit) — idempotent:
    // still mark the invite accepted, don't error, don't duplicate the row.
    if (!existingOperator) {
      await tx.truckOperator.create({
        data: { truckId: invite.truckId, userId: claimingUser.id, role: 'manager' },
      })
    }
    // Third legitimate writer of User.role (alongside the Clerk webhook and
    // lib/trucks.ts#createTruck) — never downgrades an existing operator/admin.
    if (claimingUser.role === 'customer') {
      await tx.user.update({ where: { id: claimingUser.id }, data: { role: 'operator' } })
    }
    await tx.truckInvite.update({
      where: { id: invite.id },
      data: { status: 'accepted', acceptedAt: new Date(), acceptedByUserId: claimingUser.id },
    })
  })

  return { truckId: invite.truckId }
}

/** Current managers on a truck's team page (the owner isn't shown through this list). */
export async function listManagers(truckId: string): Promise<TruckManagerView[]> {
  const operators = await db.truckOperator.findMany({
    where: { truckId, role: 'manager' },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  })
  return operators.map((op) => ({
    userId: op.user.id,
    email: op.user.email,
    displayName: op.user.displayName,
  }))
}

/**
 * Removes a manager's access. An owner can never remove themselves through
 * this path (ownership transfer isn't built yet) — enforced both by an
 * explicit check and, belt-and-suspenders, by scoping the delete itself to
 * role: 'manager' so an owner row can't be deleted here even if the
 * explicit check were ever bypassed.
 */
export async function removeManager(
  truckId: string,
  managerUserId: string,
  requestingUserId: string,
): Promise<void> {
  if (managerUserId === requestingUserId) {
    throw new Error("Owners can't remove themselves — transfer ownership isn't built yet")
  }

  const result = await db.truckOperator.deleteMany({
    where: { truckId, userId: managerUserId, role: 'manager' },
  })
  if (result.count === 0) throw new Error('Manager not found')
}
