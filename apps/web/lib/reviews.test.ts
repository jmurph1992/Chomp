import { describe, it, expect, vi, beforeEach } from 'vitest'

const findMany = vi.fn()
const findUnique = vi.fn()
const aggregate = vi.fn()
const upsert = vi.fn()
const deleteMany = vi.fn()
const update = vi.fn()
const deleteReviewPhoto = vi.fn()

const contentReportUpdateMany = vi.fn()

vi.mock('@chomp/db', () => ({
  db: {
    review: { findMany, findUnique, aggregate, upsert, deleteMany, update },
    contentReport: { updateMany: contentReportUpdateMany },
  },
}))
vi.mock('./review-photos', () => ({ deleteReviewPhoto }))

const {
  isValidReviewBody,
  getVisibleReviewsForTruck,
  getReviewSummary,
  getOwnReview,
  upsertReview,
  deleteReview,
  setReviewVisibility,
  getAllReviewsForAdmin,
  getReviewsForUser,
  MAX_REVIEW_BODY_LENGTH,
} = await import('./reviews')

describe('isValidReviewBody', () => {
  it('accepts null, undefined, and empty string', () => {
    expect(isValidReviewBody(null)).toBe(true)
    expect(isValidReviewBody(undefined)).toBe(true)
    expect(isValidReviewBody('')).toBe(true)
  })

  it('accepts strings within the max length', () => {
    expect(isValidReviewBody('Great tacos!')).toBe(true)
  })

  it('rejects strings over the max length', () => {
    expect(isValidReviewBody('a'.repeat(MAX_REVIEW_BODY_LENGTH + 1))).toBe(false)
  })
})

function reviewRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'r1',
    truckId: 't1',
    userId: 'u1',
    rating: 5,
    body: 'Great!',
    isVisible: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    user: { displayName: 'Ada', avatarUrl: null },
    photos: [],
    ...overrides,
  }
}

describe('getVisibleReviewsForTruck', () => {
  beforeEach(() => findMany.mockReset())

  it('queries only visible reviews for the truck, newest first', async () => {
    findMany.mockResolvedValue([])
    await getVisibleReviewsForTruck('t1')

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { truckId: 't1', isVisible: true },
        orderBy: { createdAt: 'desc' },
      }),
    )
  })

  it('only fetches visible photos for each review', async () => {
    findMany.mockResolvedValue([])
    await getVisibleReviewsForTruck('t1')

    const call = findMany.mock.calls.at(0)?.at(0)
    expect(call.include.photos.where).toEqual({ isVisible: true })
  })

  it('scopes the likes lookup to an empty userId when there is no viewer', async () => {
    findMany.mockResolvedValue([])
    await getVisibleReviewsForTruck('t1')

    const call = findMany.mock.calls.at(0)?.at(0)
    expect(call.include.photos.include.likes.where).toEqual({ userId: '' })
  })

  it('scopes the likes lookup to the given viewer id', async () => {
    findMany.mockResolvedValue([])
    await getVisibleReviewsForTruck('t1', 'viewer1')

    const call = findMany.mock.calls.at(0)?.at(0)
    expect(call.include.photos.include.likes.where).toEqual({ userId: 'viewer1' })
  })

  it('maps a review with no photo to photo: null', async () => {
    findMany.mockResolvedValue([reviewRow()])
    const result = await getVisibleReviewsForTruck('t1')

    expect(result[0]).toEqual({
      id: 'r1',
      truckId: 't1',
      userId: 'u1',
      userDisplayName: 'Ada',
      userAvatarUrl: null,
      rating: 5,
      body: 'Great!',
      isVisible: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      photo: null,
    })
  })

  it('maps an erased author (userId null) to "Deleted user" with no avatar, keeping the review visible', async () => {
    findMany.mockResolvedValue([reviewRow({ userId: null, user: null })])

    const result = await getVisibleReviewsForTruck('t1')

    expect(result[0]).toEqual(
      expect.objectContaining({
        userId: null,
        userDisplayName: 'Deleted user',
        userAvatarUrl: null,
        body: 'Great!',
        isVisible: true,
      }),
    )
  })

  it('does not confuse an erased author with a live user who simply has no display name set', async () => {
    findMany.mockResolvedValue([reviewRow({ userId: 'u1', user: { displayName: null, avatarUrl: null } })])

    const result = await getVisibleReviewsForTruck('t1')

    expect(result[0]!.userId).toBe('u1')
    expect(result[0]!.userDisplayName).toBeNull() // not "Deleted user"
  })

  it('maps a review photo, including whether the viewer liked it', async () => {
    findMany.mockResolvedValue([
      reviewRow({
        photos: [
          {
            id: 'p1',
            url: 'https://imagedelivery.net/hash/p1/public',
            caption: 'Yum',
            likesCount: 3,
            likes: [{ userId: 'viewer1' }],
          },
        ],
      }),
    ])

    const result = await getVisibleReviewsForTruck('t1', 'viewer1')

    expect(result[0]!.photo).toEqual({
      id: 'p1',
      url: 'https://imagedelivery.net/hash/p1/public',
      caption: 'Yum',
      likesCount: 3,
      isLikedByViewer: true,
    })
  })
})

describe('getReviewSummary', () => {
  beforeEach(() => aggregate.mockReset())

  it('only aggregates visible reviews', async () => {
    aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { _all: 2 } })

    const result = await getReviewSummary('t1')

    expect(aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { truckId: 't1', isVisible: true } }),
    )
    expect(result).toEqual({ averageRating: 4.5, reviewCount: 2 })
  })
})

describe('getOwnReview', () => {
  beforeEach(() => findUnique.mockReset())

  it('looks up by the compound truckId_userId key, ignoring isVisible', async () => {
    findUnique.mockResolvedValue(null)
    await getOwnReview('t1', 'u1')

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { truckId_userId: { truckId: 't1', userId: 'u1' } } }),
    )
    const callArgs = findUnique.mock.calls.at(0)?.at(0)
    expect(callArgs.where).not.toHaveProperty('isVisible')
  })

  it('does not filter its own photo by isVisible, unlike the public list', async () => {
    findUnique.mockResolvedValue(null)
    await getOwnReview('t1', 'u1')

    const callArgs = findUnique.mock.calls.at(0)?.at(0)
    expect(callArgs.include.photos).not.toHaveProperty('where')
  })

  it('returns null when no review exists', async () => {
    findUnique.mockResolvedValue(null)
    expect(await getOwnReview('t1', 'u1')).toBeNull()
  })
})

describe('upsertReview', () => {
  beforeEach(() => upsert.mockReset())

  it('rejects an invalid rating without touching the database', async () => {
    await expect(
      upsertReview({ truckId: 't1', userId: 'u1', rating: 6, body: null }),
    ).rejects.toThrow('Invalid rating')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('rejects an oversized body without touching the database', async () => {
    await expect(
      upsertReview({
        truckId: 't1',
        userId: 'u1',
        rating: 5,
        body: 'a'.repeat(MAX_REVIEW_BODY_LENGTH + 1),
      }),
    ).rejects.toThrow('too long')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('upserts keyed on truckId_userId for valid input', async () => {
    upsert.mockResolvedValue({})
    await upsertReview({ truckId: 't1', userId: 'u1', rating: 5, body: 'Great!' })

    expect(upsert).toHaveBeenCalledWith({
      where: { truckId_userId: { truckId: 't1', userId: 'u1' } },
      create: { truckId: 't1', userId: 'u1', rating: 5, body: 'Great!' },
      update: { rating: 5, body: 'Great!' },
    })
  })
})

describe('deleteReview', () => {
  beforeEach(() => {
    deleteMany.mockReset()
    deleteReviewPhoto.mockReset()
  })

  it('cleans up any attached photo before deleting the review (FK is ON DELETE RESTRICT)', async () => {
    deleteReviewPhoto.mockResolvedValue(undefined)
    deleteMany.mockResolvedValue({ count: 1 })

    await deleteReview('t1', 'u1')

    expect(deleteReviewPhoto).toHaveBeenCalledWith('t1', 'u1')
    expect(deleteMany).toHaveBeenCalledWith({ where: { truckId: 't1', userId: 'u1' } })
  })
})

describe('setReviewVisibility', () => {
  beforeEach(() => {
    update.mockReset()
    contentReportUpdateMany.mockReset()
  })

  it('rejects an empty reason without touching the database', async () => {
    await expect(setReviewVisibility('r1', false, '  ', 'admin1')).rejects.toThrow(
      'A moderation reason is required',
    )
    expect(update).not.toHaveBeenCalled()
  })

  it('updates isVisible, moderationNote, moderatedByUserId, and moderatedAt', async () => {
    update.mockResolvedValue({})
    await setReviewVisibility('r1', false, 'Spam', 'admin1')

    expect(update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        isVisible: false,
        moderationNote: 'Spam',
        moderatedByUserId: 'admin1',
        moderatedAt: expect.any(Date),
      },
    })
  })

  it('works the same way for unhiding', async () => {
    update.mockResolvedValue({})
    await setReviewVisibility('r1', true, 'False positive', 'admin1')

    expect(update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        isVisible: true,
        moderationNote: 'False positive',
        moderatedByUserId: 'admin1',
        moderatedAt: expect.any(Date),
      },
    })
  })

  it('closes every open ContentReport on this review when hiding', async () => {
    update.mockResolvedValue({})
    await setReviewVisibility('r1', false, 'Spam', 'admin1')

    expect(contentReportUpdateMany).toHaveBeenCalledWith({
      where: { reviewId: 'r1', status: 'open' },
      data: { status: 'resolved', resolvedByUserId: 'admin1', resolvedAt: expect.any(Date), resolutionNote: 'Spam' },
    })
  })

  it('does not touch ContentReport when unhiding', async () => {
    update.mockResolvedValue({})
    await setReviewVisibility('r1', true, 'False positive', 'admin1')

    expect(contentReportUpdateMany).not.toHaveBeenCalled()
  })
})

describe('getAllReviewsForAdmin', () => {
  beforeEach(() => findMany.mockReset())

  it('queries every review, newest first, with no visibility filter but excluding orphaned (truck-deleted) rows', async () => {
    findMany.mockResolvedValue([])
    await getAllReviewsForAdmin()

    const call = findMany.mock.calls.at(0)?.at(0)
    expect(call.where).toEqual({ truckId: { not: null } })
    expect(call.orderBy).toEqual({ createdAt: 'desc' })
  })

  it('skips a row whose truck relation is unexpectedly null, defensively', async () => {
    findMany.mockResolvedValue([
      {
        id: 'r1',
        truckId: null,
        truck: null,
        rating: 5,
        body: null,
        isVisible: true,
        moderationNote: null,
        moderatedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        user: { displayName: 'Ada', email: 'ada@example.com' },
        moderator: null,
      },
    ])

    expect(await getAllReviewsForAdmin()).toEqual([])
  })

  it('maps a row including truck, reviewer, and moderation info', async () => {
    findMany.mockResolvedValue([
      {
        id: 'r1',
        truckId: 't1',
        rating: 5,
        body: 'Great!',
        isVisible: false,
        moderationNote: 'Spam',
        moderatedAt: new Date('2026-01-02T00:00:00Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        truck: { slug: 'taco-kings', name: 'Taco Kings' },
        user: { displayName: 'Ada', email: 'ada@example.com' },
        moderator: { email: 'admin@example.com' },
      },
    ])

    const result = await getAllReviewsForAdmin()

    expect(result[0]).toEqual({
      id: 'r1',
      truckId: 't1',
      truckSlug: 'taco-kings',
      truckName: 'Taco Kings',
      userDisplayName: 'Ada',
      userEmail: 'ada@example.com',
      rating: 5,
      body: 'Great!',
      isVisible: false,
      moderationNote: 'Spam',
      moderatedByEmail: 'admin@example.com',
      moderatedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('maps an erased author (userId null, user null) to "Deleted user" with a null email, not a crash', async () => {
    findMany.mockResolvedValue([
      {
        id: 'r1',
        truckId: 't1',
        userId: null,
        rating: 5,
        body: 'Great!',
        isVisible: true,
        moderationNote: null,
        moderatedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        truck: { slug: 'taco-kings', name: 'Taco Kings' },
        user: null,
        moderator: null,
      },
    ])

    const result = await getAllReviewsForAdmin()

    expect(result[0]).toEqual(
      expect.objectContaining({
        userDisplayName: 'Deleted user',
        userEmail: null,
      }),
    )
  })

  it('maps a never-moderated review to null moderation fields', async () => {
    findMany.mockResolvedValue([
      {
        id: 'r1',
        truckId: 't1',
        rating: 5,
        body: null,
        isVisible: true,
        moderationNote: null,
        moderatedAt: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        truck: { slug: 'taco-kings', name: 'Taco Kings' },
        user: { displayName: null, email: 'ada@example.com' },
        moderator: null,
      },
    ])

    const result = await getAllReviewsForAdmin()

    expect(result[0]!.moderatedByEmail).toBeNull()
    expect(result[0]!.moderatedAt).toBeNull()
  })
})

describe('getReviewsForUser', () => {
  beforeEach(() => findMany.mockReset())

  it('queries by userId only, newest first, with no isVisible filter', async () => {
    findMany.mockResolvedValue([])
    await getReviewsForUser('u1')

    const call = findMany.mock.calls.at(0)?.at(0)
    expect(call.where).toEqual({ userId: 'u1' })
    expect(call.orderBy).toEqual({ createdAt: 'desc' })
  })

  it('maps a normal (truck-attached) review, including a photo', async () => {
    findMany.mockResolvedValue([
      {
        id: 'r1',
        truckId: 't1',
        rating: 5,
        body: 'Great tacos!',
        isVisible: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        truck: { slug: 'taco-kings', name: 'Taco Kings' },
        photos: [{ id: 'p1', url: 'https://example.com/p1.jpg', caption: 'Yum' }],
      },
    ])

    const result = await getReviewsForUser('u1')

    expect(result[0]).toEqual({
      id: 'r1',
      truckId: 't1',
      truckSlug: 'taco-kings',
      truckName: 'Taco Kings',
      rating: 5,
      body: 'Great tacos!',
      isVisible: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      photo: { id: 'p1', url: 'https://example.com/p1.jpg', caption: 'Yum' },
    })
  })

  it('includes an orphaned (truck-deleted) review, with null truck fields', async () => {
    findMany.mockResolvedValue([
      {
        id: 'r2',
        truckId: null,
        rating: 3,
        body: 'It was fine',
        isVisible: true,
        createdAt: new Date('2026-01-02T00:00:00Z'),
        truck: null,
        photos: [],
      },
    ])

    const result = await getReviewsForUser('u1')

    expect(result[0]).toEqual({
      id: 'r2',
      truckId: null,
      truckSlug: null,
      truckName: null,
      rating: 3,
      body: 'It was fine',
      isVisible: true,
      createdAt: '2026-01-02T00:00:00.000Z',
      photo: null,
    })
  })

  it('surfaces isVisible: false rather than filtering the review out', async () => {
    findMany.mockResolvedValue([
      {
        id: 'r3',
        truckId: 't1',
        rating: 1,
        body: 'Rude staff',
        isVisible: false,
        createdAt: new Date('2026-01-03T00:00:00Z'),
        truck: { slug: 'taco-kings', name: 'Taco Kings' },
        photos: [],
      },
    ])

    const result = await getReviewsForUser('u1')

    expect(result[0]!.isVisible).toBe(false)
  })
})
