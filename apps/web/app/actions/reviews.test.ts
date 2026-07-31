import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUser = vi.fn()
const upsertReview = vi.fn()
const deleteReview = vi.fn()
const setReviewVisibility = vi.fn()
const canModerateReviews = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser }))
vi.mock('@/lib/reviews', () => ({ upsertReview, deleteReview, setReviewVisibility, canModerateReviews }))
vi.mock('next/cache', () => ({ revalidatePath }))

const { submitReviewAction, deleteReviewAction, setReviewVisibilityAction } = await import(
  './reviews'
)

describe('submitReviewAction', () => {
  beforeEach(() => {
    getCurrentUser.mockReset()
    upsertReview.mockReset()
    revalidatePath.mockReset()
  })

  it('rejects when signed out, without touching the database', async () => {
    getCurrentUser.mockResolvedValue(null)

    await expect(submitReviewAction('t1', 'taco-kings', 5, 'Great!')).rejects.toThrow('Sign in')
    expect(upsertReview).not.toHaveBeenCalled()
  })

  it('upserts using the server-resolved user id, never a client-supplied one', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', role: 'customer' })
    upsertReview.mockResolvedValue(undefined)

    await submitReviewAction('t1', 'taco-kings', 5, 'Great!')

    expect(upsertReview).toHaveBeenCalledWith({
      truckId: 't1',
      userId: 'u1',
      rating: 5,
      body: 'Great!',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/trucks/taco-kings')
  })
})

describe('deleteReviewAction', () => {
  beforeEach(() => {
    getCurrentUser.mockReset()
    deleteReview.mockReset()
    revalidatePath.mockReset()
  })

  it('rejects when signed out', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(deleteReviewAction('t1', 'taco-kings')).rejects.toThrow('Sign in')
    expect(deleteReview).not.toHaveBeenCalled()
  })

  it('deletes scoped to the server-resolved user id', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', role: 'customer' })
    await deleteReviewAction('t1', 'taco-kings')
    expect(deleteReview).toHaveBeenCalledWith('t1', 'u1')
  })
})

describe('setReviewVisibilityAction', () => {
  beforeEach(() => {
    getCurrentUser.mockReset()
    setReviewVisibility.mockReset()
    canModerateReviews.mockReset()
    revalidatePath.mockReset()
  })

  it('rejects when signed out', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(setReviewVisibilityAction('r1', 'taco-kings', false)).rejects.toThrow(
      'Not authorized',
    )
    expect(setReviewVisibility).not.toHaveBeenCalled()
  })

  it('rejects a signed-in non-admin', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', role: 'customer' })
    canModerateReviews.mockReturnValue(false)

    await expect(setReviewVisibilityAction('r1', 'taco-kings', false)).rejects.toThrow(
      'Not authorized',
    )
    expect(setReviewVisibility).not.toHaveBeenCalled()
  })

  it('allows an admin to hide a review', async () => {
    getCurrentUser.mockResolvedValue({ id: 'admin1', role: 'admin' })
    canModerateReviews.mockReturnValue(true)

    await setReviewVisibilityAction('r1', 'taco-kings', false)

    expect(setReviewVisibility).toHaveBeenCalledWith('r1', false)
  })
})
