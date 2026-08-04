# Roadmap — future work

> Not go-live blockers (those live in `/go-live-requirements/`) — this is the
> broader list of what's next, grouped by theme. Updated as priorities shift.

## 1. Make local dev solid
- Local Clerk webhooks can't reach `localhost` — sign-up doesn't sync a
  `User` row without a tunnel (ngrok, Clerk's own CLI tunnel). Documented in
  `/docs/features/auth.md` but not set up in this environment yet.
- No CI/check that fails when the generated Prisma Client drifts from
  `schema.prisma`, or when `packages/db`'s declared deps (e.g. `tsx`) go
  missing from `node_modules`. Both bit us in the 2026-08-04 session — silent
  until something actually exercises the missing piece.

## 2. Rate limiting, once
Three separate `/go-live-requirements/*.md` files (reviews, operator
dashboard, photo upload) each ask for rate limiting on a signed-in user's
write actions (review submission, truck creation, upload-slot requests).
Worth solving once with a shared primitive once Redis is wired up, rather
than three bespoke implementations.

## 3. Operational completeness
- Review moderation queue (admins can only one-way hide from the truck page
  today; no way to view/unhide without Prisma Studio)
- Manager-invite flow (`TruckOperator(role: manager)` is fully functional in
  the schema/permissions, but nothing creates that row — no UI)
- Truck deletion / ownership transfer (deactivating is the only lever today)
- R2 bucket lifecycle rule for orphaned/un-finalized uploads (~24h auto-expiry,
  documented, not configured)
- Feed refresh scheduler — `POST /api/cron/refresh-feed` exists and works,
  nothing calls it on a timer yet (Vercel Cron or the Inngest job the stack
  doc already commits to)

## 4. Compliance before real users
Account deletion / erasure handling — `user.deleted` webhooks are currently a
no-op. Needs a real product decision (hard delete vs. anonymize vs.
soft-delete-and-hide) before this can handle a GDPR/CCPA-style request at
national scale.

## 5. Deferred stack pieces
Sentry, Resend, Stripe — each presumably gets wired up at its own natural
trigger (first real bug worth tracking, first real email, first real
payment) rather than proactively.

## 6. App navigation — mobile-first
Flagged 2026-08-04 during a hands-on walkthrough. Confirmed scope: a real
site-wide navigation bar, and mobile nav patterns specifically — this is a
food-truck app, so mobile browser usage comes first, ahead of desktop.

**Standing direction for this and all future UI/nav work on Chomp:** design
mobile-first. Users check this app on their phone while out and about, not
at a desk, and a native mobile app (React Native + Expo — already the
documented future-phase choice in `/docs/architecture/stack.md`) is a stated
eventual goal. Treat desktop as the secondary breakpoint, and prefer
approaches (e.g. shared business logic in `packages/*`) that won't need to
be redone for that future native client.

Candidate issues observed during the 2026-08-04 walkthrough (still needs
scoping before building):
- No persistent nav bar on public pages — only "Sign in"/"Dashboard" +
  avatar in the top right; no direct links between `/`, `/feed`, and a
  truck's own page
- No mobile-specific nav pattern at all (e.g. bottom tab bar) — untested
  whether the current header even works well at phone widths
- No way back from a truck detail page to the map or feed without the
  browser's own back button
- No breadcrumbs anywhere in the operator dashboard (`/dashboard/[truckId]/*`)

## Known doc drift
- `/go-live-requirements/operator-dashboard.md` still says image upload is
  "blocked on Cloudflare R2/Images" — stale since photo upload shipped. Small
  fix, not urgent.
