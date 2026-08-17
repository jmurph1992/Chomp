import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUser = vi.fn()
const checkRateLimit = vi.fn()
const reportReview = vi.fn()
const reportReviewPhoto = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit, reportLimiter: 'report-limiter' }))
vi.mock('@/lib/reports', () => ({ reportReview, reportReviewPhoto }))

const { reportReviewAction, reportReviewPhotoAction } = await import('./reports')

const validInput = { reason: 'spam' as const, note: null }

beforeEach(() => {
  getCurrentUser.mockReset()
  checkRateLimit.mockReset()
  reportReview.mockReset()
  reportReviewPhoto.mockReset()
})

describe('reportReviewAction', () => {
  it('rejects when signed out, without writing', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(reportReviewAction('r1', validInput)).rejects.toThrow('Sign in required')
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(reportReview).not.toHaveBeenCalled()
  })

  it('rate-limits by the caller before reporting', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    checkRateLimit.mockRejectedValue(new Error("You're doing that too often — try again in a bit."))

    await expect(reportReviewAction('r1', validInput)).rejects.toThrow('too often')
    expect(checkRateLimit).toHaveBeenCalledWith('report-limiter', 'u1')
    expect(reportReview).not.toHaveBeenCalled()
  })

  it('delegates for a signed-in, unthrottled caller', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    checkRateLimit.mockResolvedValue(undefined)

    await reportReviewAction('r1', validInput)

    expect(reportReview).toHaveBeenCalledWith('r1', 'u1', validInput)
  })
})

describe('reportReviewPhotoAction', () => {
  it('rejects when signed out, without writing', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(reportReviewPhotoAction('p1', validInput)).rejects.toThrow('Sign in required')
    expect(reportReviewPhoto).not.toHaveBeenCalled()
  })

  it('delegates for a signed-in, unthrottled caller', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    checkRateLimit.mockResolvedValue(undefined)

    await reportReviewPhotoAction('p1', validInput)

    expect(reportReviewPhoto).toHaveBeenCalledWith('p1', 'u1', validInput)
  })
})
