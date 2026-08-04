import type { User } from '@chomp/db'
import { getCurrentUser } from './auth'

/**
 * The authorization boundary for admin-only surfaces (currently just the
 * truck verification queue). Same shape as requireOperator — must be called
 * at both the page layout AND independently inside every server action,
 * since actions are callable directly regardless of what the layout gates.
 */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    throw new Error('Not authorized')
  }
  return user
}
