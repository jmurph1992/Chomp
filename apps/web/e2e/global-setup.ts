import { clerkSetup } from '@clerk/testing/playwright'

/**
 * Fetches a Clerk testing token once for the whole run, required by
 * setupClerkTestingToken() (used in auth.spec.ts to bypass bot protection
 * on /sign-in). Guarded, not unconditional — a globalSetup throw aborts the
 * entire suite rather than just the Clerk-dependent tests, breaking the
 * project's existing per-file test.skip(!canRun, ...) gating convention for
 * anyone running without Clerk secrets configured.
 */
export default async function globalSetup() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) return
  await clerkSetup()
}
