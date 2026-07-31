import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const verifyWebhook = vi.fn()
const handleClerkWebhookEvent = vi.fn()

vi.mock('@clerk/nextjs/webhooks', () => ({ verifyWebhook }))
vi.mock('@/lib/clerk-webhook', () => ({ handleClerkWebhookEvent }))

const { POST } = await import('./route')

describe('POST /api/webhooks/clerk', () => {
  beforeEach(() => {
    verifyWebhook.mockReset()
    handleClerkWebhookEvent.mockReset()
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_test'
  })

  it('returns 500 without verifying when the signing secret is not configured', async () => {
    delete process.env.CLERK_WEBHOOK_SECRET

    const res = await POST(new NextRequest('http://localhost/api/webhooks/clerk', { method: 'POST' }))

    expect(res.status).toBe(500)
    expect(verifyWebhook).not.toHaveBeenCalled()
  })

  it('returns 400 and never processes the event when signature verification fails', async () => {
    verifyWebhook.mockRejectedValue(new Error('invalid signature'))

    const res = await POST(new NextRequest('http://localhost/api/webhooks/clerk', { method: 'POST' }))

    expect(res.status).toBe(400)
    expect(handleClerkWebhookEvent).not.toHaveBeenCalled()
  })

  it('processes the verified event and returns 200', async () => {
    const evt = { type: 'user.created', data: { id: 'user_123' } }
    verifyWebhook.mockResolvedValue(evt)

    const res = await POST(new NextRequest('http://localhost/api/webhooks/clerk', { method: 'POST' }))

    expect(res.status).toBe(200)
    expect(handleClerkWebhookEvent).toHaveBeenCalledWith(evt)
  })
})
