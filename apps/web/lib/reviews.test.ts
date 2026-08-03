import { describe, it, expect, vi, beforeEach } from 'vitest'

const findMany = vi.fn()
const findUnique = vi.fn()
const aggregate = vi.fn()
const upsert = vi.fn()
const deleteMany = vi.fn()
const update = vi.fn()
const deleteReviewPhoto = vi.fn()

vi.mock('@chomp/db', () => ({
  db: {
    review: { findMany, findUnique, aggregate, upsert, deleteMany, update },
  },
}))
vi.mock('./review-photos', () => ({ deleteReviewPhoto }))

const {
  isValidReviewBody,
  canModerateReviews,
  getVisibleReviewsForTruck,
  getReviewSummary,
  getOwnReview,
  upsertReview,
  deleteReview,
  setReviewVisibility,
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

describe('canModerateReviews', () => {
  it('is true only for admin', () => {
    expect(canModerateReviews('admin')).toBe(true)
    expect(canModerateReviews('customer')).toBe(false)
    expect(canModerateReviews('operator')).toBe(false)
    expect(canModerateReviews(undefined)).toBe(false)
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
  it('updates isVisible by review id', async () => {
    update.mockResolvedValue({})
    await setReviewVisibility('r1', false)

    expect(update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { isVisible: false } })
  })
})
