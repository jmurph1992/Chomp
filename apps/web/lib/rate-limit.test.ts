import { describe, it, expect, vi, beforeEach } from 'vitest'

const limit = vi.fn()
const headersGet = vi.fn()

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

vi.mock('next/headers', () => ({ headers: async () => ({ get: headersGet }) }))

const { checkRateLimit, getClientIp, reviewLimiter } = await import('./rate-limit')

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

describe('getClientIp', () => {
  beforeEach(() => headersGet.mockReset())

  it('returns the first address from x-forwarded-for', async () => {
    headersGet.mockReturnValue('1.2.3.4, 5.6.7.8')
    expect(await getClientIp()).toBe('1.2.3.4')
  })

  it('falls back to "unknown" when the header is absent', async () => {
    headersGet.mockReturnValue(null)
    expect(await getClientIp()).toBe('unknown')
  })
})
