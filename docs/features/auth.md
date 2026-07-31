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

Every new user starts as `customer`. There is no self-service way to become an
`operator` yet — that will be a separate "register your truck" flow that upgrades the
role server-side. The webhook handler is the only code path allowed to set `role`;
it always writes `customer` on creation, so a role can never be set from a client-
controlled value.

## Known gap: account deletion

`user.deleted` webhooks are currently logged and otherwise ignored — the DB row is not
deleted or soft-deleted. The `User` model has no cascade or soft-delete field yet, and a
user can own trucks/reviews, so deleting the row isn't safe as-is. This needs a real
design pass (hard delete vs. anonymize vs. soft-delete-and-hide) before launch. Tracked
in `/go-live-requirements`.

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
3. For local development, the webhook endpoint needs a public URL for Clerk to reach —
   use a tunnel (ngrok, Clerk's CLI tunnel, etc.).
