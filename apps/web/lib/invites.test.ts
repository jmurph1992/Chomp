import { describe, it, expect, vi, beforeEach } from 'vitest'

const operatorFindFirst = vi.fn()
const operatorFindUnique = vi.fn()
const operatorCreate = vi.fn()
const operatorFindMany = vi.fn()
const operatorDeleteMany = vi.fn()
const operatorUpdateMany = vi.fn()
const inviteFindFirst = vi.fn()
const inviteFindUnique = vi.fn()
const inviteFindMany = vi.fn()
const inviteCreate = vi.fn()
const inviteUpdate = vi.fn()
const inviteUpdateMany = vi.fn()
const userUpdate = vi.fn()
const truckFindUnique = vi.fn()
const truckUpdate = vi.fn()
const truckUpdateMany = vi.fn()

// claimInvite's actual grant (operator creation + marking the invite
// accepted + upgrading a customer's role), removeManager's pending-offer
// cleanup, and acceptOwnershipTransfer's role swap all run inside
// db.$transaction's callback form — reusing the same mock fns for both the
// tx-scoped and top-level calls (matching review-photos.test.ts's
// precedent) lets a single mock config cover all of them.
const tx = {
  truckOperator: { findUnique: operatorFindUnique, create: operatorCreate, deleteMany: operatorDeleteMany, updateMany: operatorUpdateMany },
  truckInvite: { update: inviteUpdate },
  truck: { update: truckUpdate, updateMany: truckUpdateMany },
  user: { update: userUpdate },
}
const transaction = vi.fn((callback: (txArg: typeof tx) => unknown) => callback(tx))

vi.mock('@chomp/db', () => ({
  db: {
    truckOperator: {
      findFirst: operatorFindFirst,
      findUnique: operatorFindUnique,
      create: operatorCreate,
      findMany: operatorFindMany,
      deleteMany: operatorDeleteMany,
      updateMany: operatorUpdateMany,
    },
    truckInvite: {
      findFirst: inviteFindFirst,
      findUnique: inviteFindUnique,
      findMany: inviteFindMany,
      create: inviteCreate,
      update: inviteUpdate,
      updateMany: inviteUpdateMany,
    },
    truck: { findUnique: truckFindUnique, update: truckUpdate, updateMany: truckUpdateMany },
    user: { update: userUpdate },
    $transaction: transaction,
  },
}))

const {
  isValidEmail,
  createInvite,
  listInvitesForTruck,
  cancelInvite,
  claimInvite,
  removeManager,
  listManagers,
  getInvitePreview,
  getPendingOwner,
  initiateOwnershipTransfer,
  cancelOwnershipTransfer,
  acceptOwnershipTransfer,
  declineOwnershipTransfer,
  adminReassignTruckOwner,
} = await import('./invites')

beforeEach(() => {
  operatorFindFirst.mockReset()
  operatorFindUnique.mockReset()
  operatorCreate.mockReset().mockResolvedValue({})
  operatorFindMany.mockReset()
  operatorDeleteMany.mockReset()
  operatorUpdateMany.mockReset()
  inviteFindFirst.mockReset()
  inviteFindUnique.mockReset()
  inviteFindMany.mockReset()
  inviteCreate.mockReset()
  inviteUpdate.mockReset().mockResolvedValue({})
  inviteUpdateMany.mockReset()
  userUpdate.mockReset().mockResolvedValue({})
  truckFindUnique.mockReset()
  truckUpdate.mockReset().mockResolvedValue({})
  truckUpdateMany.mockReset()
  transaction.mockReset().mockImplementation((callback: (txArg: typeof tx) => unknown) => callback(tx))
})

function inviteRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv1',
    truckId: 't1',
    invitedEmail: 'friend@example.com',
    token: 'tok-1',
    status: 'pending',
    createdByUserId: 'owner1',
    createdAt: new Date('2026-08-01T00:00:00Z'),
    expiresAt: new Date('2099-01-01T00:00:00Z'),
    acceptedAt: null,
    acceptedByUserId: null,
    ...overrides,
  }
}

describe('isValidEmail', () => {
  it('accepts a plausible email', () => {
    expect(isValidEmail('a@b.com')).toBe(true)
  })

  it('rejects missing @ or domain', () => {
    expect(isValidEmail('not-an-email')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('createInvite', () => {
  it('rejects an invalid email without touching the database', async () => {
    await expect(createInvite('t1', 'owner1', 'nope')).rejects.toThrow('Invalid email')
    expect(inviteCreate).not.toHaveBeenCalled()
  })

  it('rejects an email that already belongs to a current operator', async () => {
    operatorFindFirst.mockResolvedValue({ truckId: 't1', userId: 'u2' })
    await expect(createInvite('t1', 'owner1', 'friend@example.com')).rejects.toThrow(
      'already on the team',
    )
    expect(inviteCreate).not.toHaveBeenCalled()
  })

  it('reuses a live pending invite for the same truck+email instead of duplicating', async () => {
    operatorFindFirst.mockResolvedValue(null)
    const live = inviteRow()
    inviteFindFirst.mockResolvedValue(live)

    const result = await createInvite('t1', 'owner1', 'Friend@Example.com')

    expect(result.id).toBe('inv1')
    expect(inviteCreate).not.toHaveBeenCalled()
    expect(inviteUpdate).not.toHaveBeenCalled()
  })

  it('expires a stale pending invite and creates a fresh one', async () => {
    operatorFindFirst.mockResolvedValue(null)
    const stale = inviteRow({ id: 'old', expiresAt: new Date('2020-01-01T00:00:00Z') })
    inviteFindFirst.mockResolvedValue(stale)
    inviteCreate.mockResolvedValue(inviteRow({ id: 'new' }))

    const result = await createInvite('t1', 'owner1', 'friend@example.com')

    expect(inviteUpdate).toHaveBeenCalledWith({ where: { id: 'old' }, data: { status: 'expired' } })
    expect(inviteCreate).toHaveBeenCalled()
    expect(result.id).toBe('new')
  })

  it('normalizes the email (trim + lowercase) and sets a 7-day expiry', async () => {
    operatorFindFirst.mockResolvedValue(null)
    inviteFindFirst.mockResolvedValue(null)
    inviteCreate.mockResolvedValue(inviteRow())

    await createInvite('t1', 'owner1', '  Friend@Example.com  ')

    const call = inviteCreate.mock.calls.at(0)?.at(0)
    expect(call.data.invitedEmail).toBe('friend@example.com')
    expect(call.data.truckId).toBe('t1')
    expect(call.data.createdByUserId).toBe('owner1')
    const daysOut = (call.data.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    expect(daysOut).toBeGreaterThan(6.9)
    expect(daysOut).toBeLessThan(7.1)
  })
})

describe('listInvitesForTruck', () => {
  it('scopes strictly by truckId', async () => {
    inviteFindMany.mockResolvedValue([])
    await listInvitesForTruck('t1')
    expect(inviteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { truckId: 't1' } }),
    )
  })
})

describe('cancelInvite', () => {
  it('scopes the cancel by both id and truckId, only touching a pending invite', async () => {
    inviteUpdateMany.mockResolvedValue({ count: 1 })
    await cancelInvite('t1', 'inv1')
    expect(inviteUpdateMany).toHaveBeenCalledWith({
      where: { id: 'inv1', truckId: 't1', status: 'pending' },
      data: { status: 'cancelled' },
    })
  })

  it('throws for a cross-truck id or an already-resolved invite (0 rows affected)', async () => {
    inviteUpdateMany.mockResolvedValue({ count: 0 })
    await expect(cancelInvite('t1', 'inv1')).rejects.toThrow('not found')
  })
})

describe('getInvitePreview', () => {
  it('returns null for an unknown token', async () => {
    inviteFindUnique.mockResolvedValue(null)
    expect(await getInvitePreview('bad-token')).toBeNull()
  })

  it('never includes invitedEmail', async () => {
    inviteFindUnique.mockResolvedValue({ ...inviteRow(), truck: { name: 'Taco Kings' } })
    const preview = await getInvitePreview('tok-1')
    expect(preview).toEqual({ truckName: 'Taco Kings', status: 'pending', expiresAt: expect.any(String) })
    expect(preview).not.toHaveProperty('invitedEmail')
  })
})

const claimant = { id: 'u2', email: 'friend@example.com', role: 'customer' as const }

describe('claimInvite', () => {
  it('rejects an unknown token without starting a transaction', async () => {
    inviteFindUnique.mockResolvedValue(null)
    await expect(claimInvite('bad-token', claimant)).rejects.toThrow('not found')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects an already-accepted invite', async () => {
    inviteFindUnique.mockResolvedValue(inviteRow({ status: 'accepted' }))
    await expect(claimInvite('tok-1', claimant)).rejects.toThrow('already been accepted')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects a cancelled invite', async () => {
    inviteFindUnique.mockResolvedValue(inviteRow({ status: 'cancelled' }))
    await expect(claimInvite('tok-1', claimant)).rejects.toThrow('cancelled')
  })

  it('rejects an already-expired-status invite', async () => {
    inviteFindUnique.mockResolvedValue(inviteRow({ status: 'expired' }))
    await expect(claimInvite('tok-1', claimant)).rejects.toThrow('expired')
  })

  it('lazily flips a stale pending invite to expired and rejects', async () => {
    inviteFindUnique.mockResolvedValue(inviteRow({ expiresAt: new Date('2020-01-01T00:00:00Z') }))
    await expect(claimInvite('tok-1', claimant)).rejects.toThrow('expired')
    expect(inviteUpdate).toHaveBeenCalledWith({ where: { id: 'inv1' }, data: { status: 'expired' } })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects when the claiming user email does not match, without revealing the invited email', async () => {
    inviteFindUnique.mockResolvedValue(inviteRow())
    await expect(
      claimInvite('tok-1', { id: 'u2', email: 'wrong@example.com', role: 'customer' }),
    ).rejects.toThrow('different email address')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('matches email case-insensitively', async () => {
    inviteFindUnique.mockResolvedValue(inviteRow({ invitedEmail: 'friend@example.com' }))
    operatorFindUnique.mockResolvedValue(null)

    const result = await claimInvite('tok-1', {
      id: 'u2',
      email: 'Friend@Example.com',
      role: 'customer',
    })
    expect(result).toEqual({ truckId: 't1' })
  })

  it('creates the manager row, marks the invite accepted, and upgrades a customer to operator — atomically', async () => {
    inviteFindUnique.mockResolvedValue(inviteRow())
    operatorFindUnique.mockResolvedValue(null)

    await claimInvite('tok-1', claimant)

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(operatorCreate).toHaveBeenCalledWith({
      data: { truckId: 't1', userId: 'u2', role: 'manager' },
    })
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'u2' }, data: { role: 'operator' } })
    expect(inviteUpdate).toHaveBeenCalledWith({
      where: { id: 'inv1' },
      data: { status: 'accepted', acceptedAt: expect.any(Date), acceptedByUserId: 'u2' },
    })
  })

  it('does not touch role for a claimant who is already an operator or admin', async () => {
    inviteFindUnique.mockResolvedValue(inviteRow())
    operatorFindUnique.mockResolvedValue(null)

    await claimInvite('tok-1', { id: 'u2', email: 'friend@example.com', role: 'operator' })

    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('is idempotent when already an operator — marks accepted without duplicating the row', async () => {
    inviteFindUnique.mockResolvedValue(inviteRow())
    operatorFindUnique.mockResolvedValue({ truckId: 't1', userId: 'u2', role: 'manager' })

    await claimInvite('tok-1', claimant)

    expect(operatorCreate).not.toHaveBeenCalled()
    expect(inviteUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'accepted' }) }),
    )
  })
})

describe('listManagers', () => {
  it('scopes by truckId and role: manager', async () => {
    operatorFindMany.mockResolvedValue([])
    await listManagers('t1')
    expect(operatorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { truckId: 't1', role: 'manager' } }),
    )
  })
})

describe('removeManager', () => {
  it("rejects an owner trying to remove themselves, without touching the database", async () => {
    await expect(removeManager('t1', 'owner1', 'owner1')).rejects.toThrow("can't remove themselves")
    expect(operatorDeleteMany).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  it('scopes the delete by truckId, userId, and role: manager (cross-truck/owner-safe)', async () => {
    operatorDeleteMany.mockResolvedValue({ count: 1 })
    await removeManager('t1', 'u2', 'owner1')
    expect(operatorDeleteMany).toHaveBeenCalledWith({
      where: { truckId: 't1', userId: 'u2', role: 'manager' },
    })
  })

  it('throws when the target is not a manager on this truck (0 rows affected)', async () => {
    operatorDeleteMany.mockResolvedValue({ count: 0 })
    await expect(removeManager('t1', 'u2', 'owner1')).rejects.toThrow('not found')
  })

  it('clears a pending ownership offer naming the removed manager, in the same transaction', async () => {
    operatorDeleteMany.mockResolvedValue({ count: 1 })
    await removeManager('t1', 'u2', 'owner1')
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(truckUpdateMany).toHaveBeenCalledWith({
      where: { id: 't1', pendingOwnerId: 'u2' },
      data: { pendingOwnerId: null },
    })
  })
})

describe('getPendingOwner', () => {
  it('returns null when no transfer is pending', async () => {
    truckFindUnique.mockResolvedValue({ pendingOwner: null })
    expect(await getPendingOwner('t1')).toBeNull()
  })

  it('maps the pending owner to a TruckManagerView shape', async () => {
    truckFindUnique.mockResolvedValue({
      pendingOwner: { id: 'u2', email: 'manager@example.com', displayName: 'Manager' },
    })
    expect(await getPendingOwner('t1')).toEqual({
      userId: 'u2',
      email: 'manager@example.com',
      displayName: 'Manager',
    })
  })
})

describe('initiateOwnershipTransfer', () => {
  it('rejects a target with no TruckOperator row on this truck at all', async () => {
    operatorFindUnique.mockResolvedValue(null)
    await expect(initiateOwnershipTransfer('t1', 'u2')).rejects.toThrow('existing manager')
    expect(truckUpdate).not.toHaveBeenCalled()
  })

  it('rejects a target whose role on this truck is owner, not manager', async () => {
    operatorFindUnique.mockResolvedValue({ truckId: 't1', userId: 'u2', role: 'owner' })
    await expect(initiateOwnershipTransfer('t1', 'u2')).rejects.toThrow('existing manager')
    expect(truckUpdate).not.toHaveBeenCalled()
  })

  it('sets pendingOwnerId for a valid manager target', async () => {
    operatorFindUnique.mockResolvedValue({ truckId: 't1', userId: 'u2', role: 'manager' })
    await initiateOwnershipTransfer('t1', 'u2')
    expect(truckUpdate).toHaveBeenCalledWith({ where: { id: 't1' }, data: { pendingOwnerId: 'u2' } })
  })
})

describe('cancelOwnershipTransfer', () => {
  it('clears pendingOwnerId when one is set', async () => {
    truckUpdateMany.mockResolvedValue({ count: 1 })
    await cancelOwnershipTransfer('t1')
    expect(truckUpdateMany).toHaveBeenCalledWith({
      where: { id: 't1', pendingOwnerId: { not: null } },
      data: { pendingOwnerId: null },
    })
  })

  it('throws when nothing is pending (0 rows affected)', async () => {
    truckUpdateMany.mockResolvedValue({ count: 0 })
    await expect(cancelOwnershipTransfer('t1')).rejects.toThrow('No pending')
  })
})

describe('acceptOwnershipTransfer', () => {
  it('rejects a caller who is not the pending target, without starting a transaction', async () => {
    truckFindUnique.mockResolvedValue({ ownerId: 'owner1', pendingOwnerId: 'u2' })
    await expect(acceptOwnershipTransfer('t1', 'someone-else')).rejects.toThrow(
      'No pending ownership offer',
    )
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects when there is no pending offer at all', async () => {
    truckFindUnique.mockResolvedValue({ ownerId: 'owner1', pendingOwnerId: null })
    await expect(acceptOwnershipTransfer('t1', 'u2')).rejects.toThrow('No pending ownership offer')
  })

  it('swaps ownerId and both TruckOperator roles atomically', async () => {
    truckFindUnique.mockResolvedValue({ ownerId: 'owner1', pendingOwnerId: 'u2' })
    operatorUpdateMany.mockResolvedValue({ count: 1 })

    await acceptOwnershipTransfer('t1', 'u2')

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(truckUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { ownerId: 'u2', pendingOwnerId: null },
    })
    expect(operatorUpdateMany).toHaveBeenCalledWith({
      where: { truckId: 't1', userId: 'u2', role: 'manager' },
      data: { role: 'owner' },
    })
    expect(operatorUpdateMany).toHaveBeenCalledWith({
      where: { truckId: 't1', userId: 'owner1', role: 'owner' },
      data: { role: 'manager' },
    })
  })

  it('rolls back when the promote/demote counts do not both equal 1 (race condition)', async () => {
    truckFindUnique.mockResolvedValue({ ownerId: 'owner1', pendingOwnerId: 'u2' })
    operatorUpdateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 })

    await expect(acceptOwnershipTransfer('t1', 'u2')).rejects.toThrow('please retry')
  })
})

describe('declineOwnershipTransfer', () => {
  it('clears pendingOwnerId scoped to the declining user', async () => {
    truckUpdateMany.mockResolvedValue({ count: 1 })
    await declineOwnershipTransfer('t1', 'u2')
    expect(truckUpdateMany).toHaveBeenCalledWith({
      where: { id: 't1', pendingOwnerId: 'u2' },
      data: { pendingOwnerId: null },
    })
  })

  it('throws when the caller is not the pending target (0 rows affected)', async () => {
    truckUpdateMany.mockResolvedValue({ count: 0 })
    await expect(declineOwnershipTransfer('t1', 'u2')).rejects.toThrow('No pending ownership offer')
  })
})

describe('adminReassignTruckOwner', () => {
  it('throws when the truck does not exist, without starting a transaction', async () => {
    truckFindUnique.mockResolvedValue(null)
    await expect(adminReassignTruckOwner('t1', 'u2')).rejects.toThrow('Truck not found')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects a target with no TruckOperator row on this truck at all', async () => {
    truckFindUnique.mockResolvedValue({ ownerId: 'owner1' })
    operatorFindUnique.mockResolvedValue(null)
    await expect(adminReassignTruckOwner('t1', 'u2')).rejects.toThrow('existing manager')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects a target whose role on this truck is owner, not manager', async () => {
    truckFindUnique.mockResolvedValue({ ownerId: 'owner1' })
    operatorFindUnique.mockResolvedValue({ truckId: 't1', userId: 'u2', role: 'owner' })
    await expect(adminReassignTruckOwner('t1', 'u2')).rejects.toThrow('existing manager')
  })

  it('skips the offer/accept dance entirely — swaps ownership atomically, no pendingOwnerId step', async () => {
    truckFindUnique.mockResolvedValue({ ownerId: 'owner1' })
    operatorFindUnique.mockResolvedValue({ truckId: 't1', userId: 'u2', role: 'manager' })
    operatorUpdateMany.mockResolvedValue({ count: 1 })

    await adminReassignTruckOwner('t1', 'u2')

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(truckUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { ownerId: 'u2', pendingOwnerId: null },
    })
    expect(operatorUpdateMany).toHaveBeenCalledWith({
      where: { truckId: 't1', userId: 'u2', role: 'manager' },
      data: { role: 'owner' },
    })
    expect(operatorUpdateMany).toHaveBeenCalledWith({
      where: { truckId: 't1', userId: 'owner1', role: 'owner' },
      data: { role: 'manager' },
    })
  })

  it('rolls back when the promote/demote counts do not both equal 1 (race condition)', async () => {
    truckFindUnique.mockResolvedValue({ ownerId: 'owner1' })
    operatorFindUnique.mockResolvedValue({ truckId: 't1', userId: 'u2', role: 'manager' })
    operatorUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })

    await expect(adminReassignTruckOwner('t1', 'u2')).rejects.toThrow('please retry')
  })
})
