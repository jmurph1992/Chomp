import { describe, it, expect, vi, beforeEach } from 'vitest'

const limit = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: vi.fn(() => ({})) },
}))

vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow = vi.fn(() => ({}))
    limit = limit
    constructor(_config: unknown) {}
  }
  return { Ratelimit }
})

const { checkRateLimit, reviewLimiter } = await import('./rate-limit')

describe('checkRateLimit', () => {
  beforeEach(() => limit.mockReset())

  it('resolves without throwing when the limiter allows the request', async () => {
    limit.mockResolvedValue({ success: true })
    await expect(checkRateLimit(reviewLimiter, 'u1')).resolves.toBeUndefined()
  })

  it('throws a clear, user-facing message when the limiter denies the request', async () => {
    limit.mockResolvedValue({ success: false })
    await expect(checkRateLimit(reviewLimiter, 'u1')).rejects.toThrow('too often')
  })

  it('keys the limit check by the given user id, not a client-supplied identifier', async () => {
    limit.mockResolvedValue({ success: true })
    await checkRateLimit(reviewLimiter, 'u42')
    expect(limit).toHaveBeenCalledWith('u42')
  })
})
