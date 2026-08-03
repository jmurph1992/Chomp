import { auth } from '@clerk/nextjs/server'
import { db } from '@chomp/db'

/**
 * Resolves the signed-in user's DB row (with role) from the Clerk session.
 * Returns null when signed out or when the webhook hasn't synced the user yet.
 */
export async function getCurrentUser() {
  const { userId } = await auth()
  if (!userId) return null

  return db.user.findUnique({ where: { clerkId: userId } })
}
