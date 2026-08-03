import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUser = vi.fn()
const attachReviewPhoto = vi.fn()
const deleteReviewPhoto = vi.fn()
const likePhoto = vi.fn()
const unlikePhoto = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser }))
vi.mock('@/lib/review-photos', () => ({
  attachReviewPhoto,
  deleteReviewPhoto,
  likePhoto,
  unlikePhoto,
}))
vi.mock('next/cache', () => ({ revalidatePath }))

const {
  attachReviewPhotoAction,
  deleteReviewPhotoAction,
  likePhotoAction,
  unlikePhotoAction,
} = await import('./review-photos')

beforeEach(() => {
  getCurrentUser.mockReset()
  attachReviewPhoto.mockReset()
  deleteReviewPhoto.mockReset()
  likePhoto.mockReset()
  unlikePhoto.mockReset()
  revalidatePath.mockReset()
})

describe('attachReviewPhotoAction', () => {
  it('rejects when signed out, without attaching', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(
      attachReviewPhotoAction('t1', 'slug', 'uploads/x', 'caption'),
    ).rejects.toThrow('Sign in required')
    expect(attachReviewPhoto).not.toHaveBeenCalled()
  })

  it('attaches using the server-resolved user id, never a client-supplied one', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    attachReviewPhoto.mockResolvedValue(undefined)

    await attachReviewPhotoAction('t1', 'slug', 'uploads/x', 'caption')

    expect(attachReviewPhoto).toHaveBeenCalledWith('t1', 'u1', 'uploads/x', 'caption')
  })
})

describe('deleteReviewPhotoAction', () => {
  it('rejects when signed out', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(deleteReviewPhotoAction('t1', 'slug')).rejects.toThrow('Sign in required')
    expect(deleteReviewPhoto).not.toHaveBeenCalled()
  })

  it('deletes scoped to the server-resolved user id', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    await deleteReviewPhotoAction('t1', 'slug')
    expect(deleteReviewPhoto).toHaveBeenCalledWith('t1', 'u1')
  })
})

describe('likePhotoAction', () => {
  it('rejects when signed out, without liking', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(likePhotoAction('t1', 'slug', 'p1')).rejects.toThrow('Sign in required')
    expect(likePhoto).not.toHaveBeenCalled()
  })

  it('likes using the server-resolved user id', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    await likePhotoAction('t1', 'slug', 'p1')
    expect(likePhoto).toHaveBeenCalledWith('t1', 'p1', 'u1')
  })
})

describe('unlikePhotoAction', () => {
  it('rejects when signed out, without unliking', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(unlikePhotoAction('t1', 'slug', 'p1')).rejects.toThrow('Sign in required')
    expect(unlikePhoto).not.toHaveBeenCalled()
  })

  it('unlikes using the server-resolved user id', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    await unlikePhotoAction('t1', 'slug', 'p1')
    expect(unlikePhoto).toHaveBeenCalledWith('t1', 'p1', 'u1')
  })
})
