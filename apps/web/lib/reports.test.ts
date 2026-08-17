import { describe, it, expect, vi, beforeEach } from 'vitest'

const reviewFindUnique = vi.fn()
const photoFindUnique = vi.fn()
const contentReportFindFirst = vi.fn()
const contentReportFindUnique = vi.fn()
const contentReportFindMany = vi.fn()
const contentReportCreate = vi.fn()
const contentReportUpdateMany = vi.fn()
const setReviewVisibility = vi.fn()
const setReviewPhotoVisibility = vi.fn()

vi.mock('@chomp/db', () => ({
  db: {
    review: { findUnique: reviewFindUnique },
    reviewPhoto: { findUnique: photoFindUnique },
    contentReport: {
      findFirst: contentReportFindFirst,
      findUnique: contentReportFindUnique,
      findMany: contentReportFindMany,
      create: contentReportCreate,
      updateMany: contentReportUpdateMany,
    },
  },
}))
vi.mock('./reviews', () => ({ setReviewVisibility }))
vi.mock('./review-photos', () => ({ setReviewPhotoVisibility }))

const {
  reportReview,
  reportReviewPhoto,
  getAllContentReports,
  resolveContentReport,
  dismissContentReport,
} = await import('./reports')

const validInput = { reason: 'spam' as const, note: null }

beforeEach(() => {
  reviewFindUnique.mockReset()
  photoFindUnique.mockReset()
  contentReportFindFirst.mockReset()
  contentReportFindUnique.mockReset()
  contentReportFindMany.mockReset()
  contentReportCreate.mockReset()
  contentReportUpdateMany.mockReset()
  setReviewVisibility.mockReset()
  setReviewPhotoVisibility.mockReset()
})

describe('reportReview', () => {
  it('rejects an invalid reason without touching the database', async () => {
    // @ts-expect-error deliberately invalid
    await expect(reportReview('r1', 'u1', { reason: 'nonsense', note: null })).rejects.toThrow(
      'Invalid report reason',
    )
    expect(reviewFindUnique).not.toHaveBeenCalled()
  })

  it('rejects a missing or hidden review', async () => {
    reviewFindUnique.mockResolvedValue(null)
    await expect(reportReview('r1', 'u1', validInput)).rejects.toThrow('Review not found')

    reviewFindUnique.mockResolvedValue({ userId: 'other', isVisible: false })
    await expect(reportReview('r1', 'u1', validInput)).rejects.toThrow('Review not found')
    expect(contentReportCreate).not.toHaveBeenCalled()
  })

  it('rejects reporting your own review', async () => {
    reviewFindUnique.mockResolvedValue({ userId: 'u1', isVisible: true })
    await expect(reportReview('r1', 'u1', validInput)).rejects.toThrow("can't report your own review")
    expect(contentReportCreate).not.toHaveBeenCalled()
  })

  it('rejects a duplicate report from the same user', async () => {
    reviewFindUnique.mockResolvedValue({ userId: 'other', isVisible: true })
    contentReportFindFirst.mockResolvedValue({ id: 'existing' })

    await expect(reportReview('r1', 'u1', validInput)).rejects.toThrow('already reported')
    expect(contentReportFindFirst).toHaveBeenCalledWith({ where: { reviewId: 'r1', reporterUserId: 'u1' } })
    expect(contentReportCreate).not.toHaveBeenCalled()
  })

  it('creates the report for a valid, non-duplicate case', async () => {
    reviewFindUnique.mockResolvedValue({ userId: 'other', isVisible: true })
    contentReportFindFirst.mockResolvedValue(null)
    contentReportCreate.mockResolvedValue({})

    await reportReview('r1', 'u1', { reason: 'harassment', note: 'rude' })

    expect(contentReportCreate).toHaveBeenCalledWith({
      data: { reviewId: 'r1', reporterUserId: 'u1', reason: 'harassment', note: 'rude' },
    })
  })
})

describe('reportReviewPhoto', () => {
  it('rejects a missing or hidden photo', async () => {
    photoFindUnique.mockResolvedValue(null)
    await expect(reportReviewPhoto('p1', 'u1', validInput)).rejects.toThrow('Photo not found')
  })

  it('rejects reporting your own photo', async () => {
    photoFindUnique.mockResolvedValue({ userId: 'u1', isVisible: true })
    await expect(reportReviewPhoto('p1', 'u1', validInput)).rejects.toThrow("can't report your own photo")
  })

  it('rejects a duplicate report from the same user', async () => {
    photoFindUnique.mockResolvedValue({ userId: 'other', isVisible: true })
    contentReportFindFirst.mockResolvedValue({ id: 'existing' })

    await expect(reportReviewPhoto('p1', 'u1', validInput)).rejects.toThrow('already reported')
    expect(contentReportFindFirst).toHaveBeenCalledWith({
      where: { reviewPhotoId: 'p1', reporterUserId: 'u1' },
    })
  })

  it('creates the report for a valid, non-duplicate case', async () => {
    photoFindUnique.mockResolvedValue({ userId: 'other', isVisible: true })
    contentReportFindFirst.mockResolvedValue(null)
    contentReportCreate.mockResolvedValue({})

    await reportReviewPhoto('p1', 'u1', validInput)

    expect(contentReportCreate).toHaveBeenCalledWith({
      data: { reviewPhotoId: 'p1', reporterUserId: 'u1', reason: 'spam', note: null },
    })
  })
})

describe('getAllContentReports', () => {
  it('excludes reports on an orphaned (truck-deleted) target', async () => {
    contentReportFindMany.mockResolvedValue([
      {
        id: 'rep1',
        reason: 'spam',
        note: null,
        status: 'open',
        reporter: { email: 'a@example.com' },
        resolvedByUser: null,
        review: { id: 'r1', body: 'bad', rating: 1, truck: null },
        reviewPhoto: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        resolvedAt: null,
        resolutionNote: null,
      },
    ])

    expect(await getAllContentReports()).toEqual([])
  })

  it('maps a report on a review', async () => {
    contentReportFindMany.mockResolvedValue([
      {
        id: 'rep1',
        reason: 'spam',
        note: 'looks fake',
        status: 'open',
        reporter: { email: 'a@example.com' },
        resolvedByUser: null,
        review: { id: 'r1', body: 'bad', rating: 1, truck: { slug: 'taco-kings', name: 'Taco Kings' } },
        reviewPhoto: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        resolvedAt: null,
        resolutionNote: null,
      },
    ])

    const result = await getAllContentReports()
    expect(result).toEqual([
      {
        id: 'rep1',
        reason: 'spam',
        note: 'looks fake',
        status: 'open',
        reporterEmail: 'a@example.com',
        truckSlug: 'taco-kings',
        truckName: 'Taco Kings',
        review: { id: 'r1', body: 'bad', rating: 1 },
        reviewPhoto: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        resolvedAt: null,
        resolvedByEmail: null,
        resolutionNote: null,
      },
    ])
  })
})

describe('resolveContentReport', () => {
  it('rejects an empty resolution note without touching the database', async () => {
    await expect(resolveContentReport('rep1', 'admin1', '  ')).rejects.toThrow(
      'A resolution reason is required',
    )
    expect(contentReportFindUnique).not.toHaveBeenCalled()
  })

  it('throws when the report is not found or already resolved', async () => {
    contentReportFindUnique.mockResolvedValue(null)
    await expect(resolveContentReport('rep1', 'admin1', 'Confirmed spam')).rejects.toThrow(
      'not found or already resolved',
    )

    contentReportFindUnique.mockResolvedValue({ id: 'rep1', status: 'resolved', reviewId: 'r1' })
    await expect(resolveContentReport('rep1', 'admin1', 'Confirmed spam')).rejects.toThrow(
      'not found or already resolved',
    )
  })

  it('hides the review, deriving the target from the report row, never client input', async () => {
    contentReportFindUnique.mockResolvedValue({ id: 'rep1', status: 'open', reviewId: 'r1', reviewPhotoId: null })

    await resolveContentReport('rep1', 'admin1', 'Confirmed spam')

    expect(setReviewVisibility).toHaveBeenCalledWith('r1', false, 'Confirmed spam', 'admin1')
    expect(setReviewPhotoVisibility).not.toHaveBeenCalled()
  })

  it('hides the photo when the report targets a photo', async () => {
    contentReportFindUnique.mockResolvedValue({ id: 'rep1', status: 'open', reviewId: null, reviewPhotoId: 'p1' })

    await resolveContentReport('rep1', 'admin1', 'Confirmed spam')

    expect(setReviewPhotoVisibility).toHaveBeenCalledWith('p1', false, 'Confirmed spam', 'admin1')
    expect(setReviewVisibility).not.toHaveBeenCalled()
  })
})

describe('dismissContentReport', () => {
  it('rejects an empty resolution note without touching the database', async () => {
    await expect(dismissContentReport('rep1', 'admin1', '  ')).rejects.toThrow(
      'A resolution reason is required',
    )
    expect(contentReportUpdateMany).not.toHaveBeenCalled()
  })

  it('scopes the update to this report only, never cascading to others', async () => {
    contentReportUpdateMany.mockResolvedValue({ count: 1 })

    await dismissContentReport('rep1', 'admin1', 'Not actionable')

    expect(contentReportUpdateMany).toHaveBeenCalledWith({
      where: { id: 'rep1', status: 'open' },
      data: {
        status: 'dismissed',
        resolvedByUserId: 'admin1',
        resolvedAt: expect.any(Date),
        resolutionNote: 'Not actionable',
      },
    })
    expect(setReviewVisibility).not.toHaveBeenCalled()
    expect(setReviewPhotoVisibility).not.toHaveBeenCalled()
  })

  it('throws when the report is not found or already resolved', async () => {
    contentReportUpdateMany.mockResolvedValue({ count: 0 })
    await expect(dismissContentReport('rep1', 'admin1', 'Not actionable')).rejects.toThrow(
      'not found or already resolved',
    )
  })
})
