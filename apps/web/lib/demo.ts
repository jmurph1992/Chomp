/**
 * True on the read-only public demo deployment — a separate Vercel project
 * pointed at its own seeded, non-production database. Demo never wires up
 * Clerk at all (no ClerkProvider, no clerkMiddleware, no keys required):
 * every place that would normally gate on a signed-in session instead sends
 * the visitor to the real app to create a real account. See
 * /docs/features/demo-mode.md.
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
}

/** Where a demo visitor is sent to create a real account on the live app. */
export function signupUrl(): string {
  return process.env.NEXT_PUBLIC_SIGNUP_URL ?? '/sign-up'
}
