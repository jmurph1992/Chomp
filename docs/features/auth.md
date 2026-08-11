# Auth

Authentication is handled by Clerk. Clerk owns credentials, sessions, and sign-in/sign-up
UI; our Postgres `users` table is a read-mostly mirror kept in sync via webhook, and is
the source of truth for the app-level `role` (`customer` | `operator` | `admin`).

## Flow

1. A user signs in/up through Clerk's prebuilt components at `/sign-in` and `/sign-up`
   (`apps/web/app/sign-in`, `apps/web/app/sign-up`).
2. Clerk sends a `user.created` / `user.updated` / `user.deleted` webhook to
   `POST /api/webhooks/clerk` (`apps/web/app/api/webhooks/clerk/route.ts`).
3. The route verifies the request signature via `verifyWebhook` (`@clerk/nextjs/webhooks`,
   which uses `CLERK_WEBHOOK_SECRET`) before touching anything, then hands the verified
   event to `apps/web/lib/clerk-webhook.ts`, which upserts the `User` row.
4. Server code that needs the DB user (role, display name, etc.) calls
   `getCurrentUser()` in `apps/web/lib/auth.ts`, which reads the Clerk session and looks
   up the matching row by `clerkId`.

## Route protection

`apps/web/middleware.ts` uses `clerkMiddleware()`. Routes are protected by default;
the public allowlist covers discovery surfaces users should be able to browse signed
out: `/`, `/trucks/*`, `/feed/*`, the auth pages themselves, and the webhook endpoint
(which authenticates itself via signature, not a session).

## Roles

Every new user starts as `customer`. There are exactly three places `User.role`
is ever written server-side — never from a client-supplied value:

1. The Clerk webhook handler (`apps/web/lib/clerk-webhook.ts`), which always writes
   `customer` on `user.created` and never changes `role` on `user.updated`.
2. `apps/web/lib/trucks.ts#createTruck`, called from the operator dashboard's
   "create your truck" flow (`docs/features/operator-dashboard.md`) — creating a
   truck makes the caller its owner and upgrades a `customer` to `operator`. It
   never downgrades an existing `operator` or `admin`.
3. `apps/web/lib/invites.ts#claimInvite`, called when someone accepts a
   manager invite (`docs/features/manager-invites.md`) — same upgrade,
   same never-downgrades rule.

`admin` is not self-service anywhere — it's set out-of-band (Prisma Studio/direct
DB access), same as `verificationStatus` on trucks (see
`/docs/features/truck-verification.md`) — and as of this pass, `admin` is also
what gates `/admin/trucks`, so there's currently no seeded admin user in the
dev DB either.

## Account deletion / erasure

`user.deleted` hands off to an Inngest job that hard-deletes the `User` row, anonymizing
(not deleting) their reviews/photos and cascading their purely-personal data. See
`/docs/features/account-erasure.md` for the full design.

## Testing

- Unit tests (`apps/web/lib/clerk-webhook.test.ts`, `.../api/webhooks/clerk/route.test.ts`)
  cover signature verification failures and each event type, with `@clerk/nextjs/webhooks`
  and `@chomp/db` mocked.
- `apps/web/e2e/auth.spec.ts` has two Playwright specs, both requiring real config to run:
  - A webhook integration test that signs a Clerk-shaped payload itself (via
    `standardwebhooks`, the same library Clerk uses) and posts it to the running
    server, then asserts the DB row — this doesn't require Clerk to reach the server,
    only `CLERK_WEBHOOK_SECRET` and `DATABASE_URL`.
  - A smoke test that the `/sign-in` page renders Clerk's widget, requiring
    `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and using `@clerk/testing` to bypass bot
    protection.

## Setup checklist (for whoever configures the Clerk app)

1. Create a Clerk application, add the publishable/secret keys to `.env.local`.
2. Add a webhook endpoint in the Clerk dashboard pointing at
   `<your-domain>/api/webhooks/clerk`, subscribed to `user.created`, `user.updated`,
   `user.deleted`. Copy the signing secret into `CLERK_WEBHOOK_SECRET`.
3. For local development, the webhook endpoint needs a public URL for Clerk to reach.
   We use Clerk's own CLI (no third-party tunnel account needed, tightest integration
   with the Clerk dashboard):
   - Install once: `npx clerk` (no install) or `pnpm add -g clerk` /
     `curl -fsSL https://clerk.com/install | bash` for a persistent install.
   - Run `pnpm dev` in one terminal (so `localhost:3000` is listening), then in
     another terminal run:
     `clerk webhooks listen --forward-to http://localhost:3000/api/webhooks/clerk`
     This opens a relay tunnel and prints a public URL forwarding to the local route —
     no dashboard-side webhook endpoint edit needed for this flow (it doesn't require
     a linked project or the Platform API). Pass `--token <value>` to pin a stable,
     reusable URL across restarts instead of getting a new one each time.
   - Alternative: if you'd rather point Clerk's dashboard webhook config itself at a
     tunnel (e.g. to test with the exact endpoint that'll run in production), swap in
     ngrok or another generic tunnel and update the dashboard's webhook URL for the
     dev Clerk instance only — never point a production webhook at a tunnel URL.
   - Without this, sign-up/sign-in still works locally (Clerk's hosted UI doesn't need
     the tunnel), but the `User` row never syncs — the webhook that creates it
     (`apps/web/app/api/webhooks/clerk/route.ts`) has no way to reach `localhost`.
