import type { NextRequest } from 'next/server'
import { refreshFeedView } from '@/lib/feed'

/**
 * Refreshes the feed materialized view. Not publicly triggerable — gated by
 * CRON_SECRET (point a scheduler, e.g. Vercel Cron, at this with that bearer
 * token). No automatic Inngest scheduling yet — this route is the whole
 * refresh story for now.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not configured')
    return new Response('Not configured', { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  await refreshFeedView()

  return new Response('OK', { status: 200 })
}
