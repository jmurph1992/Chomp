import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const refreshFeedView = vi.fn()

vi.mock('@/lib/feed', () => ({ refreshFeedView }))

const { POST } = await import('./route')

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/cron/refresh-feed', { method: 'POST', headers })
}

describe('POST /api/cron/refresh-feed', () => {
  beforeEach(() => {
    refreshFeedView.mockReset()
    process.env.CRON_SECRET = 'test-secret'
  })

  it('returns 500 without refreshing when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET

    const res = await POST(req({ authorization: 'Bearer whatever' }))

    expect(res.status).toBe(500)
    expect(refreshFeedView).not.toHaveBeenCalled()
  })

  it('returns 401 and never refreshes when the token is missing or wrong', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)

    const res2 = await POST(req({ authorization: 'Bearer wrong' }))
    expect(res2.status).toBe(401)

    expect(refreshFeedView).not.toHaveBeenCalled()
  })

  it('refreshes and returns 200 with the correct bearer token', async () => {
    refreshFeedView.mockResolvedValue(undefined)

    const res = await POST(req({ authorization: 'Bearer test-secret' }))

    expect(res.status).toBe(200)
    expect(refreshFeedView).toHaveBeenCalledTimes(1)
  })
})
