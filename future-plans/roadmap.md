# Roadmap — future work

> Not go-live blockers (those live in `/go-live-requirements/`) — this is the
> broader list of what's next, grouped by theme. Updated as priorities shift.

## 0. Location freshness / "Active now" — planned, not yet built (2026-08-12)
Flagged during a product gap-analysis against the app's core "find food
trucks near you" use case: a truck's posted location shows indefinitely
today, with no signal for whether it's actually still there.
Fully scoped — an operator declares how long they'll be at a location when
posting it (presets: 1h/2h/3h/4h/6h/All day), and trucks whose window has
lapsed drop out of "nearby" map results while still being reachable via
direct link/favorites/feed. Full technical plan, ready to build straight
from: `future-plans/location-freshness-plan.md`.

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
- ~~Truck ownership transfer~~ — done 2026-08-10, see the prioritized list
  below. ~~Truck deletion~~ — also done 2026-08-10, see the prioritized list
  below.
- ~~R2 bucket lifecycle rule for orphaned/un-finalized uploads~~ — done
  2026-08-07, see the prioritized list below

## 4. Compliance before real users — done 2026-08-11
~~Account deletion / erasure handling~~ — see `/docs/features/account-erasure.md`.
Reviews/photos are anonymized (kept, "Deleted user"); the `User` row is
hard-deleted via an Inngest job triggered off the `user.deleted` webhook; a
user who's the sole owner of a truck is blocked (never auto-resolved) and
routed to a new generic admin moderation queue, which also became the first
in-app admin user-management surface (`/admin/users`) this app has ever had.

## 5. Deferred stack pieces
Sentry, Resend, Stripe — each presumably gets wired up at its own natural
trigger (first real bug worth tracking, first real email, first real
payment) rather than proactively.

## 6. App navigation — mobile-first — done 2026-08-12
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

All four candidate issues observed during the 2026-08-04 walkthrough are
resolved — see `/docs/features/navigation.md`:
- ~~No persistent nav bar on public pages~~ — a real site-wide nav (desktop
  inline row / mobile hamburger + drawer) now links `/`, `/feed`, and (when
  applicable) Dashboard/Admin/Account, replacing the old ad hoc header.
- ~~No mobile-specific nav pattern~~ — hamburger opens a shadcn `Sheet`
  drawer on mobile; the first real shadcn/ui usage in the repo.
- ~~No way back from a truck detail page to the map or feed~~ — smart
  back-nav (`router.back()` when arriving in-app, else a fixed `/feed`
  link), via a `sessionStorage`-backed path stack.
- ~~No breadcrumbs in the operator dashboard~~ — `Dashboard > {truck} >
  {tab}`, sourced from the same `DASHBOARD_TABS` list the tab row uses.

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
5. ~~Truck ownership transfer~~ — **done 2026-08-10**, see
   `/docs/features/operator-dashboard.md#ownership-transfer`. Built as an
   offer/accept flow between the owner and an existing manager (new nullable
   `Truck.pendingOwnerId` column) — the owner initiates, but nothing changes
   until the target manager explicitly accepts, mirroring the manager-invite
   flow's own explicit-accept step.

   **Truck deletion is still open** — split out as its own, higher-risk item
   below, now that transfer is done.

6. ~~Truck deletion~~ — **done 2026-08-10**, see
   `/docs/features/operator-dashboard.md#truck-deletion`. Resolved the FK
   tension noted below by orphaning, not preserving-as-viewable: an owner can
   permanently delete their truck (type-the-name-to-confirm, owner-only).
   `TruckOperator`/`TruckLocation`/`TruckSchedule`/`MenuCategory`/`MenuItem`/
   `TruckEvent` all cascade-delete at the DB level; `Review`/`ReviewPhoto`
   rows are orphaned (`truckId` set `NULL`, `onDelete: SetNull`) — kept for
   record-keeping, invisible everywhere in the product (no "my reviews" page
   exists yet to show them — deliberately deferred, see memory
   `project-my-reviews-page-deferred`). Cloudflare Images assets (logo,
   cover, menu items, review photos) are gathered before the delete and
   best-effort cleaned up after. Verified against the real Neon dev DB with a
   fully-populated throwaway truck — every cascade path confirmed, including
   the `MenuItem`/`MenuCategory` multi-path case.

   With this, every item on the "operational completeness" list is done. The
   `future-plans/roadmap.md` item that originally bundled deletion and
   transfer together (item 5, above) is fully closed.

7. ~~Account page, Phase 1 (profile details + reviews)~~ — **done
   2026-08-10**, see `/docs/features/account.md`. Closes the "no 'my
   reviews' page" gap noted in item 6 above — `/account` now surfaces a
   signed-in user's own reviews, including orphaned ones, with a "(deleted)"
   state instead of a link; embeds Clerk's own `<UserProfile />` for profile
   editing rather than building custom forms.

   **Phase 2 (favorites — trucks and individual menu items) is done too**,
   also 2026-08-10, see `/docs/features/account.md#favorites`. Two new
   cascading join tables (`TruckFavorite`, `MenuItemFavorite` — private
   only, no public count); favorite toggles on the truck detail page, its
   menu items, and the map's popups (the one genuinely new UI pattern —
   Mapbox popups are raw DOM, not React, so that toggle manages its own
   state directly instead of relying on `revalidatePath` + re-render like
   everywhere else). With this, the account page's full original vision
   (profile details, favorites, reviews) is built.
