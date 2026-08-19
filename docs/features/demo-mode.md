# Demo Mode

A second, read-only public deployment (`demo.<domain>`) for sharing the app
before it has real users — pre-seeded with sample trucks/reviews (via
`packages/db/prisma/seed.ts`) against its own Neon branch, completely
isolated from the production database.

## How it works

`NEXT_PUBLIC_DEMO_MODE=true` on the demo deployment only. When set:

- **No Clerk wiring at all.** `app/layout.tsx` skips `<ClerkProvider>`,
  `middleware.ts` skips `clerkMiddleware` entirely (see `demoMiddleware`
  there), and `lib/auth.ts#getCurrentUser` short-circuits to `null` before
  ever calling Clerk's `auth()`. No Clerk keys are required in the demo
  deployment's env — visitors are always treated as signed out.
- **Routes that need an account redirect out.** `/sign-in`, `/sign-up`,
  `/dashboard`, `/account`, `/admin` all redirect (307) to
  `NEXT_PUBLIC_SIGNUP_URL` — the real production app's `/sign-up` — rather
  than rendering Clerk UI that would crash without a provider.
- **Write affordances hide instead of crash.** Every place that used to
  render Clerk's `<SignedIn>` directly (favoriting a truck or menu item,
  reporting content, the event-notify toggle, the truck-list favorite
  button) now goes through `components/signed-in-safe.tsx`'s `<SignedInSafe>`
  — a drop-in wrapper that renders nothing in demo mode instead of throwing
  "must be wrapped in ClerkProvider". Two places instead show a "Sign up on
  the real app" CTA rather than just disappearing, since disappearing there
  would be a confusing dead end: `components/nav/site-header.tsx` (the
  header's sign-in button) and `components/truck-reviews.tsx` (the
  "sign in to write a review" prompt).
- **A persistent banner** (`components/demo-banner.tsx`) reminds visitors
  they're on sample data and links to sign up on the real app.

## Env vars

- `NEXT_PUBLIC_DEMO_MODE` — `'true'` on the demo deployment, unset/`false`
  everywhere else.
- `NEXT_PUBLIC_SIGNUP_URL` — where a demo visitor is sent to create a real
  account (the production app's `/sign-up`). Only read when demo mode is on;
  falls back to the local `/sign-up` route otherwise (harmless, since that
  code path never runs outside demo mode).

## Adding a new Clerk-gated UI element

If it should just disappear for a demo visitor (most write actions),
wrap it in `<SignedInSafe>` instead of Clerk's `<SignedIn>`. If it needs a
demo-specific fallback (a CTA, a read-only version), branch on
`isDemoMode()` from `lib/demo.ts` directly, following the pattern in
`site-header.tsx` or `truck-reviews.tsx`.

## Deliberately out of scope

- No write path at all on the demo deployment — it's intentionally
  browse-only, not a sandboxed trial account with reset data.
- Shares every other third-party credential (Mapbox, Cloudflare, Upstash,
  Resend, Inngest) with production rather than provisioning duplicates,
  since nothing in demo mode ever exercises a write path that would use
  them for real.
