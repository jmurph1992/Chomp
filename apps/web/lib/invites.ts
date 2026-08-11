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
 * this path — enforced both by an explicit check and, belt-and-suspenders,
 * by scoping the delete itself to role: 'manager' so an owner row can't be
 * deleted here even if the explicit check were ever bypassed. Use
 * initiateOwnershipTransfer to step back from a truck instead.
 *
 * Also clears any pending ownership-transfer offer naming this manager as
 * the target, in the same transaction — otherwise removing a manager who
 * has a pending offer would leave a dangling, unacceptable offer on the truck.
 */
export async function removeManager(
  truckId: string,
  managerUserId: string,
  requestingUserId: string,
): Promise<void> {
  if (managerUserId === requestingUserId) {
    throw new Error("Owners can't remove themselves — transfer ownership isn't built yet")
  }

  await db.$transaction(async (tx) => {
    const result = await tx.truckOperator.deleteMany({
      where: { truckId, userId: managerUserId, role: 'manager' },
    })
    if (result.count === 0) throw new Error('Manager not found')

    await tx.truck.updateMany({
      where: { id: truckId, pendingOwnerId: managerUserId },
      data: { pendingOwnerId: null },
    })
  })
}

/** Current owner and any pending-transfer target, for the team page's owner-only banner. */
export async function getPendingOwner(truckId: string): Promise<TruckManagerView | null> {
  const truck = await db.truck.findUnique({
    where: { id: truckId },
    select: { pendingOwner: { select: { id: true, email: true, displayName: true } } },
  })
  if (!truck?.pendingOwner) return null
  return {
    userId: truck.pendingOwner.id,
    email: truck.pendingOwner.email,
    displayName: truck.pendingOwner.displayName,
  }
}

/**
 * Owner offers ownership to an existing manager. Overwrites any previous
 * pending offer on this truck — only one offer is live at a time.
 */
export async function initiateOwnershipTransfer(truckId: string, newOwnerUserId: string): Promise<void> {
  const target = await db.truckOperator.findUnique({
    where: { truckId_userId: { truckId, userId: newOwnerUserId } },
  })
  if (!target || target.role !== 'manager') {
    throw new Error('Only an existing manager can be offered ownership')
  }

  await db.truck.update({ where: { id: truckId }, data: { pendingOwnerId: newOwnerUserId } })
}

/** Owner revokes a pending offer before it's accepted or declined. */
export async function cancelOwnershipTransfer(truckId: string): Promise<void> {
  const result = await db.truck.updateMany({
    where: { id: truckId, pendingOwnerId: { not: null } },
    data: { pendingOwnerId: null },
  })
  if (result.count === 0) throw new Error('No pending ownership transfer')
}

/**
 * The offered manager accepts — swaps Truck.ownerId and both TruckOperator
 * roles in one transaction. Scoped entirely by "does pendingOwnerId match
 * you," not requireOperator/requireOwner, since the accepting user is a
 * manager, not (yet) the owner.
 */
export async function acceptOwnershipTransfer(truckId: string, acceptingUserId: string): Promise<void> {
  const truck = await db.truck.findUnique({
    where: { id: truckId },
    select: { ownerId: true, pendingOwnerId: true },
  })
  if (!truck || truck.pendingOwnerId !== acceptingUserId) {
    throw new Error('No pending ownership offer for you on this truck')
  }

  await db.$transaction(async (tx) => {
    await tx.truck.update({
      where: { id: truckId },
      data: { ownerId: acceptingUserId, pendingOwnerId: null },
    })
    const promoted = await tx.truckOperator.updateMany({
      where: { truckId, userId: acceptingUserId, role: 'manager' },
      data: { role: 'owner' },
    })
    const demoted = await tx.truckOperator.updateMany({
      where: { truckId, userId: truck.ownerId, role: 'owner' },
      data: { role: 'manager' },
    })
    if (promoted.count !== 1 || demoted.count !== 1) {
      throw new Error('Ownership transfer failed — team membership changed, please retry')
    }
  })
}

/** The offered manager declines — just clears the offer, nothing else changes. */
export async function declineOwnershipTransfer(truckId: string, decliningUserId: string): Promise<void> {
  const result = await db.truck.updateMany({
    where: { id: truckId, pendingOwnerId: decliningUserId },
    data: { pendingOwnerId: null },
  })
  if (result.count === 0) throw new Error('No pending ownership offer for you on this truck')
}

/**
 * Admin-only escape hatch for a truck whose owner is unreachable (banned or
 * already erased, blocked in the moderation queue — see
 * lib/moderation-queue.ts). Mirrors acceptOwnershipTransfer's transaction but
 * skips the offer/accept dance entirely, since the outgoing owner can't
 * participate to consent. Still requires the target to already be an
 * existing manager, same constraint as the normal flow. Caller (the admin
 * server action) is responsible for requireAdmin() — this function performs
 * no authorization check itself, same convention as setReviewVisibility.
 */
export async function adminReassignTruckOwner(truckId: string, newOwnerUserId: string): Promise<void> {
  const truck = await db.truck.findUnique({ where: { id: truckId }, select: { ownerId: true } })
  if (!truck) throw new Error('Truck not found')

  const target = await db.truckOperator.findUnique({
    where: { truckId_userId: { truckId, userId: newOwnerUserId } },
  })
  if (!target || target.role !== 'manager') {
    throw new Error('Only an existing manager can be reassigned ownership')
  }

  await db.$transaction(async (tx) => {
    await tx.truck.update({
      where: { id: truckId },
      data: { ownerId: newOwnerUserId, pendingOwnerId: null },
    })
    const promoted = await tx.truckOperator.updateMany({
      where: { truckId, userId: newOwnerUserId, role: 'manager' },
      data: { role: 'owner' },
    })
    const demoted = await tx.truckOperator.updateMany({
      where: { truckId, userId: truck.ownerId, role: 'owner' },
      data: { role: 'manager' },
    })
    if (promoted.count !== 1 || demoted.count !== 1) {
      throw new Error('Ownership reassignment failed — team membership changed, please retry')
    }
  })
}
