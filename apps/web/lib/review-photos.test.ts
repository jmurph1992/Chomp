import { describe, it, expect, vi, beforeEach } from 'vitest'

const reviewFindUnique = vi.fn()
const photoFindFirst = vi.fn()
const photoFindUnique = vi.fn()
const photoCreate = vi.fn()
const photoDelete = vi.fn()
const photoUpdate = vi.fn()
const likeDeleteMany = vi.fn()
const likeCreate = vi.fn()
const ingestUploadedImage = vi.fn()
const deleteCloudflareImage = vi.fn()
const extractCloudflareImageId = vi.fn()

// likePhoto uses the callback form of $transaction (not the array form) —
// this lets the mock genuinely invoke tx.photoLike.create/tx.reviewPhoto.update
// in sequence, so a rejection from one propagates through a single real
// promise chain instead of requiring eagerly-evaluated array elements to be
// reconciled with a separately-configured $transaction mock.
const tx = { photoLike: { create: likeCreate }, reviewPhoto: { update: photoUpdate } }
const transaction = vi.fn((callback: (txArg: typeof tx) => unknown) => callback(tx))

vi.mock('@chomp/db', () => ({
  db: {
    review: { findUnique: reviewFindUnique },
    reviewPhoto: {
      findFirst: photoFindFirst,
      findUnique: photoFindUnique,
      create: photoCreate,
      delete: photoDelete,
      update: photoUpdate,
    },
    photoLike: { deleteMany: likeDeleteMany, create: likeCreate },
    $transaction: transaction,
  },
}))
vi.mock('./storage', () => ({ ingestUploadedImage, deleteCloudflareImage, extractCloudflareImageId }))

const { attachReviewPhoto, deleteReviewPhoto, likePhoto, unlikePhoto, isValidCaption, MAX_CAPTION_LENGTH } =
  await import('./review-photos')

beforeEach(() => {
  reviewFindUnique.mockReset()
  photoFindFirst.mockReset()
  photoFindUnique.mockReset()
  photoCreate.mockReset()
  photoDelete.mockReset()
  photoUpdate.mockReset().mockResolvedValue({})
  likeDeleteMany.mockReset()
  likeCreate.mockReset().mockResolvedValue({})
  transaction.mockReset().mockImplementation((callback: (txArg: typeof tx) => unknown) => callback(tx))
  ingestUploadedImage.mockReset()
  deleteCloudflareImage.mockReset()
  extractCloudflareImageId.mockReset()
})

describe('isValidCaption', () => {
  it('accepts null and strings within the max length', () => {
    expect(isValidCaption(null)).toBe(true)
    expect(isValidCaption('Yum')).toBe(true)
  })

  it('rejects strings over the max length', () => {
    expect(isValidCaption('a'.repeat(MAX_CAPTION_LENGTH + 1))).toBe(false)
  })
})

describe('attachReviewPhoto', () => {
  it('rejects an oversized caption without ingesting or touching the database', async () => {
    await expect(
      attachReviewPhoto('t1', 'u1', 'uploads/x', 'a'.repeat(MAX_CAPTION_LENGTH + 1)),
    ).rejects.toThrow('Caption too long')
    expect(ingestUploadedImage).not.toHaveBeenCalled()
  })

  it('requires the caller to already have a review for this truck', async () => {
    reviewFindUnique.mockResolvedValue(null)

    await expect(attachReviewPhoto('t1', 'u1', 'uploads/x', null)).rejects.toThrow(
      'Write a review',
    )
    expect(ingestUploadedImage).not.toHaveBeenCalled()
  })

  it('creates the photo scoped to the caller\'s own review — never a client-supplied reviewId', async () => {
    reviewFindUnique.mockResolvedValue({ id: 'r1' })
    photoFindFirst.mockResolvedValue(null) // no existing photo to replace
    ingestUploadedImage.mockResolvedValue({ url: 'https://imagedelivery.net/h/img-1/public', imageId: 'img-1' })
    photoCreate.mockResolvedValue({})

    await attachReviewPhoto('t1', 'u1', 'uploads/x', 'Yum')

    expect(reviewFindUnique).toHaveBeenCalledWith({
      where: { truckId_userId: { truckId: 't1', userId: 'u1' } },
    })
    expect(photoCreate).toHaveBeenCalledWith({
      data: {
        reviewId: 'r1',
        userId: 'u1',
        truckId: 't1',
        url: 'https://imagedelivery.net/h/img-1/public',
        caption: 'Yum',
        isVisible: true,
        likesCount: 0,
      },
    })
  })

  it('replaces an existing photo: deletes its likes, the row, and its Cloudflare Images asset', async () => {
    reviewFindUnique.mockResolvedValue({ id: 'r1' })
    photoFindFirst.mockResolvedValue({ id: 'old-photo', url: 'https://imagedelivery.net/h/old/public' })
    likeDeleteMany.mockResolvedValue({ count: 2 })
    photoDelete.mockResolvedValue({})
    extractCloudflareImageId.mockReturnValue('old')
    ingestUploadedImage.mockResolvedValue({ url: 'https://imagedelivery.net/h/new/public', imageId: 'new' })
    photoCreate.mockResolvedValue({})

    await attachReviewPhoto('t1', 'u1', 'uploads/x', null)

    expect(likeDeleteMany).toHaveBeenCalledWith({ where: { photoId: 'old-photo' } })
    expect(photoDelete).toHaveBeenCalledWith({ where: { id: 'old-photo' } })
    expect(deleteCloudflareImage).toHaveBeenCalledWith('old')
    expect(photoCreate).toHaveBeenCalled()
  })
})

describe('deleteReviewPhoto', () => {
  it('no-ops when the caller has no review for this truck', async () => {
    reviewFindUnique.mockResolvedValue(null)
    await deleteReviewPhoto('t1', 'u1')
    expect(photoFindFirst).not.toHaveBeenCalled()
  })

  it('no-ops when the review has no photo', async () => {
    reviewFindUnique.mockResolvedValue({ id: 'r1' })
    photoFindFirst.mockResolvedValue(null)
    await deleteReviewPhoto('t1', 'u1')
    expect(photoDelete).not.toHaveBeenCalled()
  })
})

describe('likePhoto', () => {
  it('rejects a nonexistent photo', async () => {
    photoFindUnique.mockResolvedValue(null)
    await expect(likePhoto('t1', 'p1', 'u1')).rejects.toThrow('not found')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects a hidden photo', async () => {
    photoFindUnique.mockResolvedValue({ id: 'p1', isVisible: false, truckId: 't1' })
    await expect(likePhoto('t1', 'p1', 'u1')).rejects.toThrow('not found')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects a photo that belongs to a different truck', async () => {
    photoFindUnique.mockResolvedValue({ id: 'p1', isVisible: true, truckId: 't2' })
    await expect(likePhoto('t1', 'p1', 'u1')).rejects.toThrow('not found')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('creates the like and increments the count in one transaction', async () => {
    photoFindUnique.mockResolvedValue({ id: 'p1', isVisible: true, truckId: 't1' })
    await likePhoto('t1', 'p1', 'u1')
    expect(transaction).toHaveBeenCalledTimes(1)
  })

  it('is idempotent — a duplicate like (unique constraint violation) does not throw', async () => {
    photoFindUnique.mockResolvedValue({ id: 'p1', isVisible: true, truckId: 't1' })
    likeCreate.mockImplementation(() => Promise.reject({ code: 'P2002' }))

    await expect(likePhoto('t1', 'p1', 'u1')).resolves.toBeUndefined()
  })

  it('rethrows non-constraint errors', async () => {
    photoFindUnique.mockResolvedValue({ id: 'p1', isVisible: true, truckId: 't1' })
    likeCreate.mockImplementation(() => Promise.reject(new Error('db is down')))

    await expect(likePhoto('t1', 'p1', 'u1')).rejects.toThrow('db is down')
  })
})

describe('unlikePhoto', () => {
  it('decrements the count when a like was actually removed', async () => {
    likeDeleteMany.mockResolvedValue({ count: 1 })
    photoUpdate.mockResolvedValue({})

    await unlikePhoto('t1', 'p1', 'u1')

    expect(likeDeleteMany).toHaveBeenCalledWith({ where: { photoId: 'p1', userId: 'u1', photo: { truckId: 't1' } } })
    expect(photoUpdate).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { likesCount: { decrement: 1 } } })
  })

  it('is idempotent — unliking something not liked (or the wrong truck) does not decrement', async () => {
    likeDeleteMany.mockResolvedValue({ count: 0 })

    await unlikePhoto('t1', 'p1', 'u1')

    expect(photoUpdate).not.toHaveBeenCalled()
  })
})
