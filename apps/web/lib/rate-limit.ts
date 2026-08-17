import { headers } from 'next/headers'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

/**
 * One limiter per abuse-prone write action, each sized to that action's real
 * cost — upload slots are tightest because each successful one triggers a
 * billed Cloudflare Images ingest, not just a DB write.
 */
export const reviewLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'ratelimit:review',
})

export const truckCreationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 d'),
  prefix: 'ratelimit:truck-creation',
})

export const uploadSlotLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'ratelimit:upload-slot',
})

export const inviteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'ratelimit:invite',
})

export const eventLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 d'),
  prefix: 'ratelimit:event',
})

export const reportLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 d'),
  prefix: 'ratelimit:report',
})

/** Tight relative to the others — each call is a real, metered Mapbox Geocoding API request, same "billed external call" reasoning as uploadSlotLimiter. */
export const locationSearchLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  prefix: 'ratelimit:location-search',
})

/**
 * Throws on limit exceeded rather than returning a boolean — call sites
 * already use throw-on-reject for auth checks (see requireOperator), so this
 * surfaces through the same try/catch + error-message UI path client-side.
 */
export async function checkRateLimit(limiter: Ratelimit, userId: string): Promise<void> {
  const { success } = await limiter.limit(userId)
  if (!success) {
    throw new Error("You're doing that too often — try again in a bit.")
  }
}

/**
 * Every other limiter above keys off an authenticated user id — this is the
 * first limiter on an action anonymous visitors can call (searchLocationAction,
 * see app/actions/trucks.ts), so there's no user id to key by. Falls back to
 * a constant key when no forwarded-for header is present (e.g. local dev
 * without a proxy in front) — a shared bucket in that case, same as every
 * request effectively sharing one "unknown" caller would.
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers()
  const forwardedFor = headerList.get('x-forwarded-for')
  return forwardedFor?.split(',')[0]?.trim() || 'unknown'
}
