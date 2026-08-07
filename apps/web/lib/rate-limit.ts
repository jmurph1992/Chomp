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
