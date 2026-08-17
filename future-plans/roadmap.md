# Roadmap — future work

> Not go-live blockers (those live in `/go-live-requirements/`) — this is the
> broader list of what's next, grouped by theme. Updated as priorities shift.

## 0. Location freshness / "Active now" — done 2026-08-13
Flagged during a product gap-analysis against the app's core "find food
trucks near you" use case: a truck's posted location shows indefinitely
today, with no signal for whether it's actually still there.
An operator declares how long they'll be at a location when posting it
(presets: 1h/2h/3h/4h/6h/All day — "All day" = end of local calendar day),
and trucks whose window has lapsed drop out of "nearby" map results while
still being reachable via direct link/favorites/feed, showing a muted "last
active" state instead. Extend lets an operator push the expiry out without
re-sharing GPS, only while still active. See
`/docs/features/operator-dashboard.md#location-updates`,
`/docs/features/map.md`, `/docs/features/truck-detail.md`. Built from
`future-plans/location-freshness-plan.md`.

## 0b. Nearby-trucks list view + filter/sort — done 2026-08-13
User idea while reviewing the location-freshness plan (0, above). A Map/List
toggle on the root page (`/`, no new route), showing the exact same filtered
set the map does (verified/active/unexpired location — "Active now first"
sorting was considered and dropped during scoping, since every truck in this
list is already active by construction). Sortable by distance (default) or
rating; filterable by cuisine (dropdown built from values actually in use,
not a fixed taxonomy) and minimum rating, applied to both views at once.
Required a real small refactor first: `TruckMap` used to own its
geolocation-refetch internally with no way for a sibling to see the result —
a new `TruckDiscovery` client wrapper now owns that state, and `TruckMap`
became a controlled component. `getNearbyTrucks` gained a `LEFT JOIN`
aggregate for per-truck rating. See `/docs/features/map.md#list-view`. Built
from `future-plans/nearby-list-view-plan.md`.

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

## 7. Product gap-analysis findings (2026-08-13)
A second gap-analysis pass against the app's core use cases (the first
produced location freshness, item 0 above — that session's other findings
were never written down and couldn't be recovered, hence this re-run).
Same methodology: cross-referencing the original product scope and existing
schema against what's actually wired up, not just brainstorming.

- **a. Special events — done 2026-08-17.** Full operator CRUD
  (`/dashboard/[truckId]/events`), public display on the truck's own page
  ("Upcoming Events", below the weekly schedule) and a live (not
  materialized-view) section on `/feed`, Mapbox geocoding of the typed
  address (reusing `NEXT_PUBLIC_MAPBOX_TOKEN`, top match auto-accepted) for
  a "Get Directions" link, and an opt-in-per-truck notification
  (`TruckFavorite.notifyNewEvents`, toggled on the truck's own page,
  requires already favoriting) via a new `app/truck.event-created` Inngest
  event. Map pins deliberately skipped, same reasoning Get Directions (7b)
  used to skip the map's raw-DOM popups. See `/docs/features/events.md`.
  New migration `20260817184420_add_notify_new_events`
  (`truck_favorites.notify_new_events`, default false, no backfill) applied
  to the Neon dev DB — `TruckEvent` itself needed no schema change, already
  fully migrated since init.
- **b. "Get Directions" link — done 2026-08-13.** Truck detail page only
  (list/map popup surfaces deliberately deferred — the map's raw-DOM popup
  implementation would be a separate code path, discussed and set aside);
  shown regardless of location freshness; a single Google Maps universal
  link, address-preferred with a coordinate fallback. `getTruckBySlug`
  gained a small second raw query for coordinates. Caught a real bug during
  real-DB verification: this schema has no `@db.Uuid` on any id column (ids
  are `TEXT`), so `${truck.id}::uuid` broke the new query's `=` comparison
  — fixed by dropping the cast. See `/docs/features/truck-detail.md`. Built
  from `future-plans/get-directions-plan.md`.
- **c. Customer-facing content reporting — done 2026-08-17.** A "Report"
  action on both reviews and their attached photos (fixed reason categories
  + optional note, one report per user per item, rate-limited), triaged
  through a new dedicated `/admin/reports` queue — deliberately **not**
  built on `ModerationQueueEntry` despite its "generic" framing, since that
  table's resolve/dismiss functions hard-code Clerk account deletion/unban
  logic specific to the erasure-blocked use case. New `ContentReport` model.
  Also built photo moderation from scratch (`ReviewPhoto` had `isVisible`
  but no admin hide/unhide at all before this) — `moderationNote`/
  `moderatedByUserId`/`moderatedAt` now mirror `Review`'s existing fields.
  Resolving a report hides the content and auto-closes every other open
  report on the same item; the existing `/admin/reviews` hide button does
  the same, so the two moderation entry points can't diverge. See
  `/docs/features/content-reporting.md`.
- **d. Favorites × location freshness — done 2026-08-16.** Opt-in only
  (off by default, toggled on `/account`), direct truck-favoriters only,
  fires only on a real off→on activation transition (not on a same-window
  re-post or `extendLocation`), delivered async via a new Inngest event
  (`app/truck.activated`) fanned out by `notifyFavoritesOnActivationFunction`.
  See `/docs/features/favorite-notifications.md`. New migration
  `20260816225240_add_notify_favorite_active` (`users.notify_favorite_active`,
  default false, no backfill) applied to the Neon dev DB.
- **e. Search by truck name/city/zip — done 2026-08-17.** Two findings
  reshaped this: `TruckLocation.city`/`state`/`zip` are dead columns
  (nothing ever populates them — `postLocation` only writes a free-text
  `address`), and the discovery page had no unbounded truck lookup at all
  (`getNearbyTrucks` is geolocation-bounded). Built as: (1) a real,
  unbounded name search (`searchTrucksByName`, any verified truck
  regardless of distance) whose results replace the Map/List view with a
  lightweight results list; (2) "city/zip" reinterpreted as re-centering —
  geocode the typed string (`lib/geocoding.ts`, built for events) and feed
  it through the same `setCenter`/`getNearbyTrucksAction` path the
  geolocation callback already uses, not a text match against the empty
  columns. Both controls live in `TruckListControls`, not a global nav
  search box (`navigation.md` still cuts that). New `locationSearchLimiter`
  — the first IP-keyed rate limiter in the app, since this is the first
  action anonymous visitors can call that needed one. See
  `/docs/features/search.md`. No schema change, no migration.
- **f. "Open now" indicator — done 2026-08-17.** A new manual `Truck.timezone`
  field (IANA identifier, set on the profile form — not auto-derived from a
  posted location, works immediately at truck creation) unblocked this.
  `@chomp/utils/open-now.ts#getOpenNowStatus` (new, pure, real
  Intl-timezone-aware) computes whether the truck-local time is inside a
  posted, non-cancelled `TruckSchedule` window; truck detail page only, a
  green "Open now — until {time}" / muted "Closed" badge, no badge at all
  (falls back to the existing plain-text schedule) for a truck with no
  timezone set. Deliberately kept independent of "Active now" — same
  distinction the location-freshness feature's own naming already
  establishes. Caught and fixed an adjacent pre-existing bug along the way:
  schedule times were rendered via `toLocaleTimeString` with no `timeZone`,
  so display depended on the *server's* local timezone rather than reading
  back the literal wall-clock value the operator typed. Same-day windows
  only this pass (no overnight-crossing support), no "opens at X" for the
  closed state. See `/docs/features/truck-detail.md` and
  `/docs/features/operator-dashboard.md#timezone-powers-open-now`. New
  migration `20260817214106_add_truck_timezone`.
- **g. "Show only my favorites" filter — done 2026-08-16.** Extended the
  filter mechanism item 0b built (`@chomp/utils/truck-list-filters.ts`),
  signed-in only. Matches a truck favorited directly OR one with any
  favorited menu item (an OR read, not a write-side cascade — that
  alternative was considered and rejected, see `/docs/features/map.md#my-favorites-filter`).
  `getNearbyTrucks` gained `hasFavoritedMenuItem`, kept deliberately
  separate from `isFavorited` to avoid breaking the truck-level favorite
  toggle button.
- **h. Operator notification on verification decisions — done
  2026-08-17.** Every operator on the truck (owner + managers, no `role`
  filter) gets an email whenever an admin verifies, rejects, or holds
  their truck — always-on, no opt-in (unlike this app's other two email
  consumers), since this is core status info, not a discretionary alert.
  `verifyTruck`/`rejectTruck`/`holdTruck` (`lib/trucks.ts`) fire
  `app/truck.verification-decided` every call, deliberately with no
  dedup/transition check (each admin decision may carry a fresh reason).
  New `lib/verification-notifications.ts` + `notifyOperatorsOnVerificationDecisionFunction`
  (`inngest/functions.ts`), same shape as the other two Inngest email
  consumers. See `/docs/features/truck-verification.md#operator-notification`.
  No schema change, no migration. With this, **every item on the whole
  `future-plans/roadmap.md` list is closed**.

## Resend plumbing — done 2026-08-16 (prerequisite for 7d and 7h)
`apps/web/lib/email.ts`'s `sendEmail()`, modeled on `lib/storage.ts`'s
client-wrapper pattern. Sends from Resend's shared test domain
(`onboarding@resend.dev`) for now — no DNS/domain verification done yet,
swap to a real Chomp domain when either consumer actually ships. See
`/docs/features/email.md`, including its security note that whoever builds
7d/7h must source the recipient from Clerk, never client input. Manually
verified end-to-end with a real "Sending access only" API key — found along
the way that the shared test domain can only deliver to the Resend
account's own registered address until a domain is verified, see
`/docs/features/email.md` for what that means for testing 7d/7h.

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
