import { describe, it, expect, vi, beforeEach } from 'vitest'

const refreshFeedView = vi.fn()
const createFunction = vi.fn((config, handler) => ({ config, handler }))
const openErasureBlockedEntry = vi.fn()
const removeAllPhotoLikesForUser = vi.fn()
const deactivateTrucks = vi.fn()
const eraseUserRow = vi.fn()
const findSoleOwnedTrucks = vi.fn()
const findUserByClerkId = vi.fn()

vi.mock('@/lib/feed', () => ({ refreshFeedView }))
vi.mock('@/lib/moderation-queue', () => ({ openErasureBlockedEntry }))
vi.mock('@/lib/review-photos', () => ({ removeAllPhotoLikesForUser }))
vi.mock('@/lib/user-erasure', () => ({
  deactivateTrucks,
  eraseUserRow,
  findSoleOwnedTrucks,
  findUserByClerkId,
}))
vi.mock('./client', () => ({ inngest: { createFunction } }))

const { refreshFeedHandler, refreshFeedFunction, eraseUserHandler, eraseUserFunction } =
  await import('./functions')

async function run<T>(id: string, fn: () => Promise<T>): Promise<T> {
  return fn()
}

describe('refreshFeedHandler', () => {
  beforeEach(() => refreshFeedView.mockReset())

  it('runs refreshFeedView inside a named step', async () => {
    refreshFeedView.mockResolvedValue(undefined)
    let stepId: string | null = null
    async function run<T>(id: string, fn: () => Promise<T>): Promise<T> {
      stepId = id
      return fn()
    }

    await refreshFeedHandler({ step: { run } })

    expect(stepId).toBe('refresh-feed-view')
    expect(refreshFeedView).toHaveBeenCalledTimes(1)
  })
})

describe('refreshFeedFunction', () => {
  it('registers with the expected id and a daily cron trigger', () => {
    expect(createFunction).toHaveBeenCalledWith(
      {
        id: 'refresh-feed',
        name: 'Refresh feed materialized view',
        triggers: [{ cron: '0 0 * * *' }],
      },
      refreshFeedHandler,
    )
  })

  it('is the value returned by inngest.createFunction', () => {
    expect(refreshFeedFunction).toEqual({
      config: {
        id: 'refresh-feed',
        name: 'Refresh feed materialized view',
        triggers: [{ cron: '0 0 * * *' }],
      },
      handler: refreshFeedHandler,
    })
  })
})

describe('eraseUserHandler', () => {
  beforeEach(() => {
    findUserByClerkId.mockReset()
    findSoleOwnedTrucks.mockReset()
    deactivateTrucks.mockReset()
    openErasureBlockedEntry.mockReset()
    removeAllPhotoLikesForUser.mockReset()
    eraseUserRow.mockReset()
  })

  it('no-ops when the user cannot be found (already erased, or the sync raced ahead)', async () => {
    findUserByClerkId.mockResolvedValue(null)

    await eraseUserHandler({ step: { run }, event: { data: { clerkId: 'clerk_1' } } })

    expect(findSoleOwnedTrucks).not.toHaveBeenCalled()
    expect(eraseUserRow).not.toHaveBeenCalled()
  })

  it('holds erasure when the user is a sole owner — deactivates trucks and opens a queue entry, does not erase', async () => {
    const user = { id: 'u1', email: 'ada@example.com', displayName: 'Ada' }
    findUserByClerkId.mockResolvedValue(user)
    findSoleOwnedTrucks.mockResolvedValue([{ id: 't1', name: 'Taco Kings', slug: 'taco-kings' }])

    await eraseUserHandler({ step: { run }, event: { data: { clerkId: 'clerk_1' } } })

    expect(deactivateTrucks).toHaveBeenCalledWith(['t1'])
    expect(openErasureBlockedEntry).toHaveBeenCalledWith(
      user,
      [{ id: 't1', name: 'Taco Kings', slug: 'taco-kings' }],
      expect.stringContaining('sole owner'),
    )
    expect(removeAllPhotoLikesForUser).not.toHaveBeenCalled()
    expect(eraseUserRow).not.toHaveBeenCalled()
  })

  it('removes likes then erases when the user owns nothing', async () => {
    const user = { id: 'u1', email: 'ada@example.com', displayName: 'Ada' }
    findUserByClerkId.mockResolvedValue(user)
    findSoleOwnedTrucks.mockResolvedValue([])

    await eraseUserHandler({ step: { run }, event: { data: { clerkId: 'clerk_1' } } })

    expect(deactivateTrucks).not.toHaveBeenCalled()
    expect(openErasureBlockedEntry).not.toHaveBeenCalled()
    expect(removeAllPhotoLikesForUser).toHaveBeenCalledWith('u1')
    expect(eraseUserRow).toHaveBeenCalledWith(user)
  })
})

describe('eraseUserFunction', () => {
  it('registers with the expected id and an event trigger', () => {
    expect(createFunction).toHaveBeenCalledWith(
      { id: 'erase-user', name: 'Erase a deleted Clerk user', triggers: [{ event: 'app/user.deleted' }] },
      eraseUserHandler,
    )
  })

  it('is the value returned by inngest.createFunction', () => {
    expect(eraseUserFunction).toEqual({
      config: { id: 'erase-user', name: 'Erase a deleted Clerk user', triggers: [{ event: 'app/user.deleted' }] },
      handler: eraseUserHandler,
    })
  })
})
