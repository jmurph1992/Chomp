# Launch Sprint

Every roadmap feature is built (see `future-plans/roadmap.md` — every item,
0 through 7h, is closed as of 2026-08-17). What's left before a public
launch is entirely deployment/infrastructure readiness, not feature work.
This is the punch list for that sprint.

## Real blockers

1. **Deploy the app.** Nothing is live anywhere yet — everything so far has
   run via `next dev` locally against real dev credentials (Clerk, Mapbox,
   Cloudflare, Upstash, Neon, Resend). Pick a host (Vercel is the assumed
   default per `docs/architecture/stack.md`) and deploy.
2. **Inngest Cloud sync.** The daily feed-refresh cron *and* all three email
   notifications (favorite-activation, new-event, verification-decision —
   see `docs/features/favorite-notifications.md`, `docs/features/events.md`,
   `docs/features/truck-verification.md#operator-notification`) currently
   only run locally via the Inngest Dev Server. Needed: create an Inngest
   Cloud app, set real `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` in the
   deployment's env vars (unset `INNGEST_DEV`), and sync the deployed
   `/api/inngest` URL with Inngest Cloud.
3. **Resend domain verification.** Emails currently send from Resend's
   shared sandbox domain (`onboarding@resend.dev`), which can only actually
   deliver to the account's own registered address — no real user will
   receive any notification email until a real domain is verified in
   Resend. See "Domain configuration" below.
4. **Clerk webhook config.** Needs to be pointed at the real production URL
   and double-checked against the Clerk dashboard once there's one to
   point at (the webhook drives `user.created`/`user.updated`/`user.deleted`
   syncing — see `docs/features/auth.md`).
5. **Provision an admin user.** None exist in the seeded dev DB, and
   there's deliberately no self-serve admin-promotion flow (a security
   decision, not an oversight — see `HANDOFF.md`'s account-erasure
   session). Someone needs to manually flip a real user's `role` to
   `admin` (Prisma Studio or direct SQL) before anyone can reach
   `/admin/trucks`, `/admin/reviews`, `/admin/reports`, `/admin/users`, or
   `/admin/moderation` in production.
6. **Apply migrations to the production database.** All 17 migrations need
   `prisma migrate deploy` run against whatever DB backs production, if
   it's not the same Neon dev database already in use.
7. **Move env vars into the hosting platform.** Everything currently lives
   in `apps/web/.env.local` (gitignored, local-only) — needs to be set in
   the host's project env config instead.

## Domain configuration

Now that a real domain has been acquired, it needs to be entered in a few
places:

**In this codebase (env vars):**
- `RESEND_FROM_EMAIL` — currently unset, so `lib/email.ts` falls back to
  the Resend sandbox address. Set to an address on the new domain (e.g.
  `notifications@yourdomain.com`) once the domain is verified in Resend
  (see below).
- `NEXT_PUBLIC_APP_URL` — used by `appUrl()` (`lib/site-url.ts`) to build
  every absolute link that goes out in email (invite links, activation/
  event/verification emails). Currently unset, falls back to
  `http://localhost:3000`. Set to `https://yourdomain.com`.

**Outside the codebase (external dashboards):**
- **Resend** — add the domain, add the DNS records it provides (SPF/DKIM/
  DMARC) at the domain's registrar/DNS host, wait for verification.
- **Clerk** — add the production domain to allowed origins/redirect URLs,
  point the webhook endpoint at `https://yourdomain.com/api/webhooks/clerk`
  (see blocker 4 above).
- **Vercel** (or wherever it's deployed) — add the domain as a custom
  domain on the project, point DNS at it.
- **Inngest Cloud** — once synced (blocker 2 above), it registers against
  this same production URL.

## Not blocking, but worth doing during the sprint

- `pnpm lint` isn't actually functional yet — `next lint` drops into an
  interactive "no ESLint config found" setup wizard even in a
  non-interactive shell (found during the 2026-08-17 events session). A
  real ESLint config should get set up at some point; doesn't block launch.
- `go-live-requirements/operator-dashboard.md` has one stale line claiming
  image upload is "blocked on Cloudflare R2/Images" — that shipped long
  ago (`docs/features/photo-upload.md`), just needs the line removed.
