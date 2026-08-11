import { describe, it, expect, vi, beforeEach } from 'vitest'

const userFindUnique = vi.fn()
const truckFindMany = vi.fn()
const truckUpdateMany = vi.fn()
const moderationQueueEntryFindFirst = vi.fn()
const txUserDelete = vi.fn()
const txErasureRecordCreate = vi.fn()

const tx = {
  user: { delete: txUserDelete },
  erasureRecord: { create: txErasureRecordCreate },
}
const transaction = vi.fn((callback: (txArg: typeof tx) => unknown) => callback(tx))

vi.mock('@chomp/db', () => ({
  db: {
    $transaction: transaction,
    user: { findUnique: userFindUnique },
    truck: { findMany: truckFindMany, updateMany: truckUpdateMany },
    moderationQueueEntry: { findFirst: moderationQueueEntryFindFirst },
  },
}))

const { findUserByClerkId, findSoleOwnedTrucks, deactivateTrucks, reactivateTrucks, eraseUserRow } =
  await import('./user-erasure')

describe('findUserByClerkId', () => {
  beforeEach(() => userFindUnique.mockReset())

  it('looks up by clerkId', async () => {
    userFindUnique.mockResolvedValue({ id: 'u1' })
    const result = await findUserByClerkId('clerk_1')
    expect(userFindUnique).toHaveBeenCalledWith({ where: { clerkId: 'clerk_1' } })
    expect(result).toEqual({ id: 'u1' })
  })
})

describe('findSoleOwnedTrucks', () => {
  beforeEach(() => truckFindMany.mockReset())

  it('queries trucks by ownerId, name ascending', async () => {
    truckFindMany.mockResolvedValue([{ id: 't1', name: 'Taco Kings', slug: 'taco-kings' }])

    const result = await findSoleOwnedTrucks('u1')

    expect(truckFindMany).toHaveBeenCalledWith({
      where: { ownerId: 'u1' },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    })
    expect(result).toEqual([{ id: 't1', name: 'Taco Kings', slug: 'taco-kings' }])
  })
})

describe('deactivateTrucks / reactivateTrucks', () => {
  beforeEach(() => truckUpdateMany.mockReset())

  it('deactivateTrucks no-ops for an empty list, without querying', async () => {
    await deactivateTrucks([])
    expect(truckUpdateMany).not.toHaveBeenCalled()
  })

  it('deactivateTrucks sets isActive false for the given ids', async () => {
    await deactivateTrucks(['t1', 't2'])
    expect(truckUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['t1', 't2'] } },
      data: { isActive: false },
    })
  })

  it('reactivateTrucks no-ops for an empty list, without querying', async () => {
    await reactivateTrucks([])
    expect(truckUpdateMany).not.toHaveBeenCalled()
  })

  it('reactivateTrucks sets isActive true for the given ids', async () => {
    await reactivateTrucks(['t1'])
    expect(truckUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['t1'] } },
      data: { isActive: true },
    })
  })
})

describe('eraseUserRow', () => {
  beforeEach(() => {
    moderationQueueEntryFindFirst.mockReset()
    transaction.mockClear()
    txUserDelete.mockReset()
    txErasureRecordCreate.mockReset()
  })

  it('deletes the user and records a "direct" trigger when no resolved moderation entry exists', async () => {
    moderationQueueEntryFindFirst.mockResolvedValue(null)
    txUserDelete.mockResolvedValue({})
    txErasureRecordCreate.mockResolvedValue({})

    await eraseUserRow({ id: 'u1', email: 'Ada@Example.com' })

    expect(txUserDelete).toHaveBeenCalledWith({ where: { id: 'u1' } })
    const call = txErasureRecordCreate.mock.calls.at(0)?.at(0)
    expect(call.data.trigger).toBe('direct')
    expect(call.data.moderationQueueEntryId).toBeNull()
    // sha256("ada@example.com") — lowercased/trimmed before hashing.
    expect(call.data.emailHash).toBe('b5fc85e55755f9e0d030a10ab4429b6b2944855f9a0d60077fe832becbc41d72')
  })

  it('records "resolvedFromModerationQueue" and the entry id when a resolved entry exists for the subject', async () => {
    moderationQueueEntryFindFirst.mockResolvedValue({ id: 'entry1' })
    txUserDelete.mockResolvedValue({})
    txErasureRecordCreate.mockResolvedValue({})

    await eraseUserRow({ id: 'u1', email: 'ada@example.com' })

    expect(moderationQueueEntryFindFirst).toHaveBeenCalledWith({
      where: { subjectUserId: 'u1', status: 'resolved' },
      orderBy: { resolvedAt: 'desc' },
    })
    const call = txErasureRecordCreate.mock.calls.at(0)?.at(0)
    expect(call.data.trigger).toBe('resolvedFromModerationQueue')
    expect(call.data.moderationQueueEntryId).toBe('entry1')
  })

  it('is idempotent — swallows a P2025 (record not found) as success', async () => {
    moderationQueueEntryFindFirst.mockResolvedValue(null)
    transaction.mockRejectedValueOnce({ code: 'P2025' })

    await expect(eraseUserRow({ id: 'u1', email: 'ada@example.com' })).resolves.toBeUndefined()
  })

  it('rethrows any other error', async () => {
    moderationQueueEntryFindFirst.mockResolvedValue(null)
    transaction.mockRejectedValueOnce(new Error('connection lost'))

    await expect(eraseUserRow({ id: 'u1', email: 'ada@example.com' })).rejects.toThrow('connection lost')
  })
})
