import { clerkClient } from '@clerk/nextjs/server'

/**
 * The only file in this app allowed to touch Clerk's Backend API directly.
 * Every other file (actions, the moderation-queue lib) calls through here
 * instead — same "abstracted behind a boundary" rule already applied to
 * getCurrentUser() for reading the session. Reuses the existing
 * CLERK_SECRET_KEY (no new env var), which now also grants these destructive
 * operations — see .env.example.
 */

/**
 * Blocks sign-in without deleting the account. Reversible via unbanClerkUser.
 * Used only when a sole-ownership conflict blocks a real deletion — the
 * account stays intact so the moderation queue can restore it later.
 */
export async function banClerkUser(clerkUserId: string): Promise<void> {
  const client = await clerkClient()
  await client.users.banUser(clerkUserId)
}

/** Restores sign-in for a previously banned user — used when a moderation entry is dismissed. */
export async function unbanClerkUser(clerkUserId: string): Promise<void> {
  const client = await clerkClient()
  await client.users.unbanUser(clerkUserId)
}

/**
 * Deletes the account in Clerk. This app's own DB row is erased
 * asynchronously afterward via the user.deleted webhook -> Inngest job,
 * never synchronously by this call.
 */
export async function deleteClerkUser(clerkUserId: string): Promise<void> {
  const client = await clerkClient()
  await client.users.deleteUser(clerkUserId)
}
