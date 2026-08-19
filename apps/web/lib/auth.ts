import { auth } from '@clerk/nextjs/server'
import { db } from '@chomp/db'
import { isDemoMode } from './demo'

/**
 * Resolves the signed-in user's DB row (with role) from the Clerk session.
 * Returns null when signed out or when the webhook hasn't synced the user yet.
 * Short-circuits in demo mode before ever touching Clerk's auth() — the demo
 * deployment has no ClerkProvider/clerkMiddleware wired up at all, so calling
 * it would throw rather than just returning an empty session.
 */
export async function getCurrentUser() {
  if (isDemoMode()) return null

  const { userId } = await auth()
  if (!userId) return null

  return db.user.findUnique({ where: { clerkId: userId } })
}
