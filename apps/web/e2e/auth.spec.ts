import { test, expect } from '@playwright/test'
import { Webhook } from 'standardwebhooks'
import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { db } from '@chomp/db'

/**
 * Signs a Clerk-shaped payload the same way Clerk signs real webhook
 * deliveries, so we can exercise the full verify → sync → DB path without
 * needing a publicly reachable server for Clerk to actually call.
 */
function signClerkPayload(secret: string, body: string) {
  const id = `msg_${Date.now()}`
  const timestamp = new Date()
  const webhook = new Webhook(secret)
  const signature = webhook.sign(id, timestamp, body)
  return {
    'svix-id': id,
    'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
    'svix-signature': signature,
    'content-type': 'application/json',
  }
}

test.describe('Clerk webhook -> DB sync', () => {
  test.skip(
    !process.env.CLERK_WEBHOOK_SECRET || !process.env.DATABASE_URL,
    'requires CLERK_WEBHOOK_SECRET and DATABASE_URL to be configured',
  )

  test('user.created syncs a customer row with the primary email', async ({ request, baseURL }) => {
    const clerkId = `user_e2e_${Date.now()}`
    const payload = {
      type: 'user.created',
      object: 'event',
      data: {
        id: clerkId,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        image_url: 'https://img.clerk.com/test.png',
        primary_email_address_id: 'idn_1',
        email_addresses: [{ id: 'idn_1', email_address: `${clerkId}@example.com` }],
      },
    }
    const body = JSON.stringify(payload)
    const headers = signClerkPayload(process.env.CLERK_WEBHOOK_SECRET!, body)

    try {
      const res = await request.post(`${baseURL}/api/webhooks/clerk`, { headers, data: body })
      expect(res.status()).toBe(200)

      const user = await db.user.findUnique({ where: { clerkId } })
      expect(user?.email).toBe(`${clerkId}@example.com`)
      expect(user?.role).toBe('customer')
      expect(user?.displayName).toBe('Test User')
    } finally {
      await db.user.deleteMany({ where: { clerkId } })
    }
  })
})

test.describe('sign-in page', () => {
  test.skip(
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    'requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to be configured',
  )

  test('renders the Clerk sign-in widget', async ({ page, context }) => {
    await setupClerkTestingToken({ context })
    await page.goto('/sign-in')
    await expect(page.locator('.cl-rootBox')).toBeVisible()
  })
})
