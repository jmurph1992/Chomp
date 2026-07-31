import type { NextRequest } from 'next/server'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { handleClerkWebhookEvent } from '@/lib/clerk-webhook'

/**
 * Receives Clerk user lifecycle events. Authenticated via the Clerk webhook
 * signing secret (svix-compatible signature) — never trust this payload
 * without a successful verifyWebhook() call.
 */
export async function POST(request: NextRequest) {
  const signingSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!signingSecret) {
    console.error('CLERK_WEBHOOK_SECRET is not configured')
    return new Response('Webhook not configured', { status: 500 })
  }

  let evt
  try {
    evt = await verifyWebhook(request, { signingSecret })
  } catch (err) {
    console.error('Clerk webhook verification failed:', err)
    return new Response('Webhook verification failed', { status: 400 })
  }

  await handleClerkWebhookEvent(evt)

  return new Response('OK', { status: 200 })
}
