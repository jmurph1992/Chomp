import { describe, it, expect, vi, beforeEach } from 'vitest'

const moderationQueueEntryFindMany = vi.fn()
const moderationQueueEntryFindFirst = vi.fn()
const moderationQueueEntryFindUnique = vi.fn()
const moderationQueueEntryCreate = vi.fn()
const moderationQueueEntryUpdate = vi.fn()
const truckFindMany = vi.fn()
const userFindMany = vi.fn()
const userFindUnique = vi.fn()

vi.mock('@chomp/db', () => ({
  db: {
    moderationQueueEntry: {
      findMany: moderationQueueEntryFindMany,
      findFirst: moderationQueueEntryFindFirst,
      findUnique: moderationQueueEntryFindUnique,
      create: moderationQueueEntryCreate,
      update: moderationQueueEntryUpdate,
    },
    truck: { findMany: truckFindMany },
    user: { findMany: userFindMany, findUnique: userFindUnique },
  },
}))

const inngestSend = vi.fn()
vi.mock('@/inngest/client', () => ({ inngest: { send: inngestSend } }))

const deleteClerkUser = vi.fn()
const unbanClerkUser = vi.fn()
vi.mock('./clerk-admin', () => ({ deleteClerkUser, unbanClerkUser }))

const findSoleOwnedTrucks = vi.fn()
const reactivateTrucks = vi.fn()
vi.mock('./user-erasure', () => ({ findSoleOwnedTrucks, reactivateTrucks }))

const { getOpenModerationQueue, openErasureBlockedEntry, resolveModerationEntry, dismissModerationEntry } =
  await import('./moderation-queue')

describe('getOpenModerationQueue', () => {
  beforeEach(() => {
    moderationQueueEntryFindMany.mockReset()
    truckFindMany.mockReset()
    userFindMany.mockReset()
  })

  it('returns an empty array without further queries when there are no open entries', async () => {
    moderationQueueEntryFindMany.mockResolvedValue([])

    const result = await getOpenModerationQueue()

    expect(result).toEqual([])
    expect(truckFindMany).not.toHaveBeenCalled()
  })

  it('joins live truck name/slug/managers and resolver email onto each entry', async () => {
    moderationQueueEntryFindMany.mockResolvedValue([
      {
        id: 'entry1',
        reason: 'userErasureBlockedBySoleOwnership',
        status: 'open',
        subjectUserId: 'u1',
        subjectEmail: 'ada@example.com',
        subjectDisplayName: 'Ada',
        blockingTruckIds: ['t1'],
        note: 'Erasure held',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        resolvedAt: null,
        resolvedByUserId: null,
        resolutionNote: null,
      },
    ])
    truckFindMany.mockResolvedValue([
      {
        id: 't1',
        name: 'Taco Kings',
        slug: 'taco-kings',
        operators: [{ user: { id: 'mgr1', email: 'mgr@example.com', displayName: 'Manager' } }],
      },
    ])
    userFindMany.mockResolvedValue([])

    const result = await getOpenModerationQueue()

    expect(result).toEqual([
      {
        id: 'entry1',
        reason: 'userErasureBlockedBySoleOwnership',
        status: 'open',
        subjectUserId: 'u1',
        subjectEmail: 'ada@example.com',
        subjectDisplayName: 'Ada',
        blockingTrucks: [
          {
            id: 't1',
            name: 'Taco Kings',
            slug: 'taco-kings',
            managers: [{ userId: 'mgr1', email: 'mgr@example.com', displayName: 'Manager' }],
          },
        ],
        note: 'Erasure held',
        createdAt: '2026-01-01T00:00:00.000Z',
        resolvedAt: null,
        resolvedByEmail: null,
        resolutionNote: null,
      },
    ])
  })

  it('drops a blockingTruckId that no longer resolves to a live truck', async () => {
    moderationQueueEntryFindMany.mockResolvedValue([
      {
        id: 'entry1',
        reason: 'userErasureBlockedBySoleOwnership',
        status: 'open',
        subjectUserId: 'u1',
        subjectEmail: 'ada@example.com',
        subjectDisplayName: null,
        blockingTruckIds: ['t1', 'deleted-truck'],
        note: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        resolvedAt: null,
        resolvedByUserId: null,
        resolutionNote: null,
      },
    ])
    truckFindMany.mockResolvedValue([{ id: 't1', name: 'Taco Kings', slug: 'taco-kings', operators: [] }])
    userFindMany.mockResolvedValue([])

    const result = await getOpenModerationQueue()

    expect(result[0]?.blockingTrucks).toHaveLength(1)
    expect(result[0]?.blockingTrucks[0]?.id).toBe('t1')
  })
})

describe('openErasureBlockedEntry', () => {
  beforeEach(() => {
    moderationQueueEntryFindFirst.mockReset()
    moderationQueueEntryCreate.mockReset()
  })

  it('no-ops when an open entry already exists for this subject+reason', async () => {
    moderationQueueEntryFindFirst.mockResolvedValue({ id: 'existing' })

    await openErasureBlockedEntry(
      { id: 'u1', email: 'ada@example.com', displayName: 'Ada' },
      [{ id: 't1', name: 'Taco Kings' }],
      'note',
    )

    expect(moderationQueueEntryCreate).not.toHaveBeenCalled()
  })

  it('creates a new open entry snapshotting the subject and blocking trucks', async () => {
    moderationQueueEntryFindFirst.mockResolvedValue(null)
    moderationQueueEntryCreate.mockResolvedValue({})

    await openErasureBlockedEntry(
      { id: 'u1', email: 'ada@example.com', displayName: 'Ada' },
      [{ id: 't1', name: 'Taco Kings' }],
      'Erasure held: sole owner of at least one truck',
    )

    expect(moderationQueueEntryCreate).toHaveBeenCalledWith({
      data: {
        reason: 'userErasureBlockedBySoleOwnership',
        subjectUserId: 'u1',
        subjectEmail: 'ada@example.com',
        subjectDisplayName: 'Ada',
        blockingTruckIds: ['t1'],
        note: 'Erasure held: sole owner of at least one truck',
      },
    })
  })
})

describe('resolveModerationEntry', () => {
  beforeEach(() => {
    moderationQueueEntryFindUnique.mockReset()
    moderationQueueEntryUpdate.mockReset()
    findSoleOwnedTrucks.mockReset()
    userFindUnique.mockReset()
    deleteClerkUser.mockReset()
    inngestSend.mockReset()
  })

  it('requires a non-empty resolution note, without touching anything', async () => {
    await expect(resolveModerationEntry('entry1', 'admin1', '  ')).rejects.toThrow('resolution note is required')
    expect(moderationQueueEntryFindUnique).not.toHaveBeenCalled()
  })

  it('throws when the entry does not exist or is already resolved', async () => {
    moderationQueueEntryFindUnique.mockResolvedValue(null)
    await expect(resolveModerationEntry('entry1', 'admin1', 'ok')).rejects.toThrow('not found or already resolved')
  })

  it('throws, listing still-blocking trucks, and does not mutate when still blocked', async () => {
    moderationQueueEntryFindUnique.mockResolvedValue({ id: 'entry1', status: 'open', subjectUserId: 'u1' })
    findSoleOwnedTrucks.mockResolvedValue([{ id: 't1', name: 'Taco Kings', slug: 'taco-kings' }])

    await expect(resolveModerationEntry('entry1', 'admin1', 'ok')).rejects.toThrow('Taco Kings')
    expect(moderationQueueEntryUpdate).not.toHaveBeenCalled()
    expect(inngestSend).not.toHaveBeenCalled()
  })

  it('resolves, attempts the Clerk deletion, and always sends the erasure event directly', async () => {
    moderationQueueEntryFindUnique.mockResolvedValue({ id: 'entry1', status: 'open', subjectUserId: 'u1' })
    findSoleOwnedTrucks.mockResolvedValue([])
    userFindUnique.mockResolvedValue({ id: 'u1', clerkId: 'clerk_1' })
    moderationQueueEntryUpdate.mockResolvedValue({})
    deleteClerkUser.mockResolvedValue(undefined)

    await resolveModerationEntry('entry1', 'admin1', 'Resolved manually')

    expect(moderationQueueEntryUpdate).toHaveBeenCalledWith({
      where: { id: 'entry1' },
      data: expect.objectContaining({
        status: 'resolved',
        resolvedByUserId: 'admin1',
        resolutionNote: 'Resolved manually',
      }),
    })
    expect(deleteClerkUser).toHaveBeenCalledWith('clerk_1')
    expect(inngestSend).toHaveBeenCalledWith({ name: 'app/user.deleted', data: { clerkId: 'clerk_1' } })
  })

  it('swallows a failed Clerk deletion (already deleted directly) and still sends the erasure event', async () => {
    moderationQueueEntryFindUnique.mockResolvedValue({ id: 'entry1', status: 'open', subjectUserId: 'u1' })
    findSoleOwnedTrucks.mockResolvedValue([])
    userFindUnique.mockResolvedValue({ id: 'u1', clerkId: 'clerk_1' })
    moderationQueueEntryUpdate.mockResolvedValue({})
    deleteClerkUser.mockRejectedValue(new Error('404 not found'))

    await expect(resolveModerationEntry('entry1', 'admin1', 'Resolved manually')).resolves.toBeUndefined()
    expect(inngestSend).toHaveBeenCalledWith({ name: 'app/user.deleted', data: { clerkId: 'clerk_1' } })
  })
})

describe('dismissModerationEntry', () => {
  beforeEach(() => {
    moderationQueueEntryFindUnique.mockReset()
    moderationQueueEntryUpdate.mockReset()
    reactivateTrucks.mockReset()
    userFindUnique.mockReset()
    unbanClerkUser.mockReset()
    deleteClerkUser.mockReset()
    inngestSend.mockReset()
  })

  it('requires a non-empty resolution note, without touching anything', async () => {
    await expect(dismissModerationEntry('entry1', 'admin1', '')).rejects.toThrow('resolution note is required')
    expect(reactivateTrucks).not.toHaveBeenCalled()
  })

  it('reactivates the blocking trucks, unbans the subject, and marks the entry dismissed', async () => {
    moderationQueueEntryFindUnique.mockResolvedValue({
      id: 'entry1',
      status: 'open',
      subjectUserId: 'u1',
      blockingTruckIds: ['t1', 't2'],
    })
    userFindUnique.mockResolvedValue({ id: 'u1', clerkId: 'clerk_1' })
    moderationQueueEntryUpdate.mockResolvedValue({})

    await dismissModerationEntry('entry1', 'admin1', 'False positive')

    expect(reactivateTrucks).toHaveBeenCalledWith(['t1', 't2'])
    expect(unbanClerkUser).toHaveBeenCalledWith('clerk_1')
    expect(moderationQueueEntryUpdate).toHaveBeenCalledWith({
      where: { id: 'entry1' },
      data: expect.objectContaining({ status: 'dismissed', resolvedByUserId: 'admin1' }),
    })
  })

  it('never triggers erasure — no Clerk deletion, no Inngest event', async () => {
    moderationQueueEntryFindUnique.mockResolvedValue({
      id: 'entry1',
      status: 'open',
      subjectUserId: 'u1',
      blockingTruckIds: [],
    })
    userFindUnique.mockResolvedValue({ id: 'u1', clerkId: 'clerk_1' })
    moderationQueueEntryUpdate.mockResolvedValue({})

    await dismissModerationEntry('entry1', 'admin1', 'False positive')

    expect(deleteClerkUser).not.toHaveBeenCalled()
    expect(inngestSend).not.toHaveBeenCalled()
  })
})
