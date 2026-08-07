# Roadmap — future work

> Not go-live blockers (those live in `/go-live-requirements/`) — this is the
> broader list of what's next, grouped by theme. Updated as priorities shift.

## 1. Make local dev solid — done 2026-08-04
- ~~Local Clerk webhooks can't reach `localhost`~~ — documented the
  `clerk webhooks listen --forward-to` workflow in `/docs/features/auth.md`.
- ~~No check that fails when the generated Prisma Client drifts from
  `schema.prisma`, or when `packages/db`'s declared deps go missing~~ —
  `packages/db` now has a `postinstall: prisma generate` so the client can't
  go stale after `pnpm install`, and a husky `pre-commit` hook runs
  `prisma validate`/`prisma generate` when `schema.prisma`/migrations are
  staged and `pnpm install --frozen-lockfile` when any `package.json`/
  `pnpm-lock.yaml` is staged — both verified to actually block a bad commit
  (see HANDOFF.md, 2026-08-04 session).

## 2. Rate limiting, once — done 2026-08-04
Closed all three `/go-live-requirements/*.md` asks (reviews, operator
dashboard, photo upload) with one shared primitive
(`apps/web/lib/rate-limit.ts`) on Upstash Redis — this also wires up Redis
for the first time in the stack, ahead of its other documented uses
(location/feed caching). Full details in `/docs/features/rate-limiting.md`.

## 3. Operational completeness
- Review moderation queue (admins can only one-way hide from the truck page
  today; no way to view/unhide without Prisma Studio)
- ~~Manager-invite flow~~ — done 2026-08-07, see the prioritized list below
- Truck deletion / ownership transfer (deactivating is the only lever today)
- ~~R2 bucket lifecycle rule for orphaned/un-finalized uploads~~ — done
  2026-08-07, see the prioritized list below

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

## Operational completeness — prioritized (2026-08-05)
Next session starts here: R2 lifecycle rule first.

1. ~~Review moderation queue~~ — **done 2026-08-05**, see
   `/docs/features/reviews.md`'s "Moderation queue" section. `/admin/reviews`
   lists every review across all trucks, filterable, with reason-required
   hide/unhide and an audit trail (moderator + timestamp).
2. ~~Feed refresh scheduler~~ — **done 2026-08-05**, see
   `/docs/features/feed.md`'s "Refresh" section. An Inngest-scheduled
   function (`refreshFeedFunction`, daily cron) replaced the old
   `CRON_SECRET`-gated route — first real Inngest usage in the app, verified
   end-to-end against the local Inngest Dev Server. Still needs an Inngest
   Cloud app + sync once actually deployed.
3. ~~R2 lifecycle rule~~ — **done 2026-08-07**. `chomp-uploads` now has an
   `expire-orphaned-uploads` rule (prefix `uploads/`, delete after 1 day,
   enabled), configured directly in the Cloudflare dashboard — the scoped R2
   app-runtime credentials in `.env.local` can't manage bucket lifecycle
   config at all (confirmed `403 AccessDenied` on both
   `PutBucketLifecycleConfiguration` and the `Get` equivalent), so this had
   to be a manual dashboard change, verified by reading the dashboard's
   Lifecycle Rules tab back rather than via API. While there, found and
   removed an unrelated pre-existing bucket-wide rule ("Get outta here",
   no prefix, delete-after-1-day) that neither Claude nor initially the user
   recognized — user later confirmed they'd created it themselves under
   unrelated circumstances and it's not a concern.
4. ~~Manager-invite flow~~ — **done 2026-08-07**, see
   `/docs/features/manager-invites.md`. Shareable, email-gated link
   (no Resend — that stays deliberately unwired until it has its own natural
   trigger), 7-day expiry, owner-only, with cancel-pending and
   remove-existing-manager both built in the same pass.
5. **Truck deletion / ownership transfer** — highest-risk item: touches data
   retention, reviews/photos cascade behavior, and ownership handoff. Needs
   the most product decision-making up front.
