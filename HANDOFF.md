# Chomp — Session Handoff

> This file is updated at the end of every Claude session.
> It contains everything needed to resume work immediately.

---

## Last Updated
2026-08-19 (lint config + stale doc fix, demo-mode deployment split, Vercel CLI access, first production deploy — with a real Prisma-on-Vercel outage found and fixed along the way)

## Current Phase
**Clerk auth, map view, truck detail page (profile + schedule + menu + reviews + photos + favorites), the public feed, the operator dashboard (now including manager invites, ownership transfer, and truck deletion), photo upload (R2 + Cloudflare Images hybrid), a full customer-facing account page (profile + favorites + reviews), and a mobile-first site-wide nav (desktop row / mobile drawer, smart back-nav, dashboard breadcrumbs) all wired up and code-complete. All migrations are applied to the Neon dev DB (11 total, latest adds the two favorites tables). Real Clerk, Mapbox, Cloudflare (R2 + Images), and Upstash Redis credentials are in `apps/web/.env.local` and verified working end-to-end. Cloudflare credentials are least-privilege: a dedicated R2 token scoped to only the `chomp-uploads` bucket, and a separate Images-only general API token. The Neon dev DB is seeded (6 trucks, reviews, a liked photo, refreshed feed — no manager fixtures, see "Not yet done" below). Local dev experience (roadmap item 1) is solid: a `postinstall` hook keeps the Prisma Client from going stale, a husky pre-commit hook catches schema/lockfile drift before it's committed, and the Clerk webhook tunnel workflow is documented. Rate limiting (roadmap item 2) is done: review submission, truck creation, upload-slot requests, and invite creation are all limited via a shared Upstash Redis primitive. Truck verification is built: new trucks are hidden from the map/public page until an admin approves them via `/admin/trucks`, and a previously verified truck can be pulled back off the map ("on hold"). Review moderation is built: `/admin/reviews` is a full queue (filterable, reason-required hide/unhide, audit trail), and excludes orphaned (truck-deleted) reviews. The feed's daily refresh is automatic: an Inngest-scheduled function replaced the old manual `CRON_SECRET` route — verified working locally against the Inngest Dev Server, though production activation still needs an Inngest Cloud app + sync once actually deployed (Open Item 17). The R2 bucket lifecycle rule for orphaned uploads is configured (`expire-orphaned-uploads`, 1 day). Manager invites, ownership transfer, and truck deletion are all built (see prior sessions below) — every item on the "operational completeness" roadmap list is done. `/account`: embeds Clerk's own `<UserProfile />` for profile editing, a read-only list of everything the signed-in user has ever reviewed (including orphaned ones, shown as "(deleted)" rather than disappearing — this is what closes the orphaned-reviews gap from the truck-deletion session), and now **favorites** too — a private (no public count) save list for trucks and individual menu items, with toggle buttons on the truck detail page, its menu items, and (the one genuinely new UI pattern this session) the map's popups, which are raw DOM rather than React. Account deletion/erasure handling (roadmap item 4) is now also done (2026-08-11, see below and `/docs/features/account-erasure.md`): `user.deleted` hands off to an Inngest job that hard-deletes the `User` row, anonymizing (not deleting) their reviews/photos; a user who's the sole owner of a truck is never auto-resolved — blocked and routed to a new generic admin moderation queue instead, which doubles as this app's first-ever in-app admin user-management surface (`/admin/users`, `/admin/moderation`). A 12th migration is applied for this. Mobile-first nav (roadmap item 6) is now **done** (2026-08-12, see below and `/docs/features/navigation.md`) — the last item on the roadmap that was still open. A site-wide responsive nav (desktop inline row / mobile hamburger + `Sheet` drawer, shadcn/ui's first real usage in this repo), role-filtered Dashboard/Admin links (fixing a bug where any signed-in user saw "Dashboard"), smart back-nav on the truck detail page, and breadcrumbs in the operator dashboard are all built and tested. With this, every item on the whole `future-plans/roadmap.md` list was closed as of the 2026-08-12 session. **This session (2026-08-13) built two more, back to back**: **location freshness / "Active now"** (roadmap item 0, see below and `/docs/features/operator-dashboard.md#location-updates`) — an operator posting a location now also declares how long they'll be there (presets 1h/2h/3h/4h/6h/All day, "All day" = end of local calendar day), and a truck whose window has lapsed drops out of "nearby" map results while still showing on its own direct-link page with a muted "last active" state instead of the green "Active now" badge; an Extend action lets an operator push the expiry out without re-sharing GPS, only while still active. No migration needed — `TruckLocation.expiresAt` already existed, unused, since the first migration. Then, once the user flagged it mid-session, **a nearby-trucks list view + filter/sort** (roadmap item 0b, see below and `/docs/features/map.md#list-view`) — a Map/List toggle on the root page showing the exact same filtered set the map does, sortable by distance/rating, filterable by cuisine/minimum rating; required first lifting `TruckMap`'s internal geolocation-refetch out into a new `TruckDiscovery` wrapper so a sibling list view could see the same data. **Then, at the user's request, a second product gap-analysis pass** (roadmap item 7, a-h) re-surfaced 8 candidate gaps — the closest match to a named-but-unbuilt original scope item is `TruckEvent` (special appearances/events, fully modeled in the schema, explicitly commented "Planned feature — not yet wired to the UI," never scoped this session); the one item actually built this session is **b, a "Get Directions" link** on the truck detail page (Google Maps universal link, address-preferred with a coordinate fallback) — caught and fixed a real bug along the way (this schema has no `@db.Uuid` on any id column, so a `::uuid` cast broke a new raw-SQL `WHERE` comparison; found via a real Playwright run against the live dev DB, not unit tests). Items 0, 0b, and 7b are closed; the rest of item 7 (a, c-h) is flagged in the roadmap but not yet scoped. The app is ready to run/deploy against real data. **This session (2026-08-16)** scoped and built two more of item 7's smaller gaps: **item 7g, a "show only my favorites" filter** (signed-in only, matches a truck favorited directly or via any of its menu items, `getNearbyTrucks` gained `hasFavoritedMenuItem` kept deliberately separate from `isFavorited` — see below and `/docs/features/map.md#my-favorites-filter`), and **Resend plumbing** (`apps/web/lib/email.ts`, a bare `sendEmail()` foundation with no product consumer yet, sending from Resend's shared test domain — see below and `/docs/features/email.md`) as a shared prerequisite for items 7d and 7h. The Resend plumbing was manually verified end-to-end (a scoped "Sending access only" API key, real send confirmed) — along the way, discovered Resend's shared test domain only delivers to the account's own registered email until a domain is verified, documented in `/docs/features/email.md` for whoever tests 7h next. **Then, same session, item 7d itself got scoped and built**: opt-in (off by default, toggled on `/account`) email to a truck's direct favoriters when it goes "Active now," firing only on a real off→on activation transition, delivered async via a new Inngest event/function pair — see below and `/docs/features/favorite-notifications.md`. A new migration (`20260816225240_add_notify_favorite_active`) was presented and approved before running. Item 7h remains unscoped.** **This session (2026-08-17) built item 7a, special events** — the closest match to a named-but-unbuilt original scope item (`TruckEvent` existed fully in the schema since init, explicitly commented "Planned feature — not yet wired to the UI") is now wired up end-to-end: full operator CRUD at `/dashboard/[truckId]/events`, a new "Upcoming Events" section on the truck detail page plus a **live** (not materialized-view) section on `/feed`, Mapbox geocoding of the typed address for a "Get Directions" link (reusing `NEXT_PUBLIC_MAPBOX_TOKEN`, top match auto-accepted, never blocks creation on a miss), and an opt-in-per-truck notification (`TruckFavorite.notifyNewEvents`, toggled on the truck's own page, requires already favoriting) via a new `app/truck.event-created` Inngest event/function pair. See `/docs/features/events.md`. A new migration (`20260817184420_add_notify_new_events`) was presented and approved before running. Manually verified end-to-end against the real Neon dev DB and a running Inngest Dev Server: real Mapbox geocode hit/miss, event CRUD including the truckId-scoped IDOR check, the "upcoming" filter on both the truck page and feed reads, the `app/truck.event-created` event firing and the notification function running (0 recipients, since nobody had opted in — email send itself wasn't exercised, same untested-in-practice gap `favorite-notifications.md` already has), and real page renders of both `/trucks/taco-kings` and `/feed` showing the new section and a working Get Directions link. **Not verified**: the dashboard editor UI and the notify-toggle click interaction in an actual browser — this repo has no documented way to sign in locally as a seeded operator without real Clerk credentials, so those paths were exercised at the `lib/events.ts`/`app/actions/events.ts` level (unit tests + the DB-level manual script) rather than through the browser. **Then, same day, item 7c — customer content reporting** — was scoped and built: a "Report" action on both reviews and their attached photos (fixed reason categories + optional note, one report per user per item, rate-limited), triaged through a new dedicated `/admin/reports` queue. Important finding along the way: `ModerationQueueEntry` (the existing "generic" queue table) turned out **not** to be safely reusable for this — its resolve/dismiss functions hard-code Clerk account deletion/unban logic specific to the erasure-blocked use case — so a new `ContentReport` model was built instead. Also built photo moderation from scratch (`ReviewPhoto` had `isVisible` but zero admin hide/unhide capability before this), mirroring `Review`'s existing moderation fields exactly. Resolving a report hides the content and auto-closes every other open report on the same item; the *existing* `/admin/reviews` hide button now does the same, so the two moderation entry points can't diverge. A new migration (`20260817200058_add_content_reporting`) was presented and approved before running. Manually verified end-to-end against the real Neon dev DB (throwaway script): own-content rejection, duplicate-report rejection, a real resolve that both hid the review and closed the report, a real dismiss that left the photo untouched, and the auto-resolve cascade across two open reports on the same review. See `/docs/features/content-reporting.md`. **Then, same day, item 7e — search** — was scoped and built: two independent controls in `TruckListControls`. Two findings shaped it: `TruckLocation.city`/`state`/`zip` are dead columns (nothing ever writes them — `postLocation` only saves a free-text `address`), and the discovery page had no unbounded truck lookup at all before this (`getNearbyTrucks` is geolocation-bounded, radius-limited, capped at 100). Built as (1) a real, unbounded name search (`searchTrucksByName` — any verified truck regardless of distance, not a client-side filter over the nearby set) whose results replace the Map/List view with a lightweight results list, and (2) "city/zip" reinterpreted as re-centering rather than text-matching — geocode the typed string via `lib/geocoding.ts` (built for events) and run it through the exact same `setCenter`/`getNearbyTrucksAction` path the geolocation callback already uses. Also added `lib/rate-limit.ts#getClientIp` and a new `locationSearchLimiter` — the first IP-keyed rate limiter in the app, since `searchLocationAction` is the first anonymous-callable action that needed one (every other limiter keys off a signed-in user id; this one has a real per-call Mapbox cost but no auth requirement). See `/docs/features/search.md`. No schema change, no migration. Manually verified against the real Neon dev DB: `next dev` + curl confirmed both search inputs render on `/` with no server error, and a throwaway script confirmed `searchTrucksByName`'s partial/case-insensitive match, its verified-only gate (created and deleted a throwaway unverified truck to prove it's excluded), and a real `geocodeAddress` lookup for "Austin, TX". **Then, same day, item 7f — "Open now" indicator** — was scoped and built: a new manual `Truck.timezone` field (IANA identifier, set on the profile form, not auto-derived from a posted location — works immediately at truck creation, no new dependency) unblocked it. `@chomp/utils/open-now.ts#getOpenNowStatus` (new, pure, real Intl-timezone-aware — proven with two different zones producing different results for the same instant/schedule, not a UTC pass-through in disguise) computes whether the truck-local time falls inside a posted, non-cancelled `TruckSchedule` window; truck detail page only, a green "Open now — until {time}" / muted "Closed" badge, no badge at all for a truck with no timezone set (exact same plain-text fallback as before this field existed — verified with a real page render both ways). Deliberately kept independent of "Active now" — the app's own naming already reserved "Open now" for this. Caught and fixed an adjacent pre-existing bug along the way: `formatTime` in both the truck detail page and the schedule editor rendered stored schedule times via `toLocaleTimeString` with no `timeZone`, so display depended on the *server's* own local timezone rather than reading back the literal wall-clock value the operator typed — both now pass `timeZone: 'UTC'` explicitly. Same-day windows only this pass (no overnight-crossing support), no "opens at X" forward-scan for the closed state, no map/list surface. A new migration (`20260817214106_add_truck_timezone`) was presented and approved before running. Manually verified end-to-end against the real Neon dev DB: a throwaway script confirmed `getOpenNowStatus` correctly returns `unknown` before a timezone is set, computes the real current status correctly against the seed truck's actual schedule once one is set (both the negative "closed" case for the real current moment and a synthetic positive "open" case), and a real page render confirmed the badge appears when set and is absent (exact prior fallback behavior) when not — timezone reverted to null afterward, no lasting change to seed data. **Then, same day, item 7h — operator notification on verification decisions** — was scoped and built, closing the last open item on the entire `future-plans/roadmap.md` list. Every operator on a truck (owner + managers, no `role` filter — same "manager parity" reasoning applied everywhere else) now gets an email whenever an admin verifies, rejects, or holds their truck; always-on with no opt-in preference, unlike this app's other two email consumers, since this is core status info about the operator's own truck, not a discretionary alert. `verifyTruck`/`rejectTruck`/`holdTruck` (`lib/trucks.ts`) each fire `app/truck.verification-decided` after their write, deliberately with **no dedup/transition check** — every call notifies, including a re-reject with an updated reason, since each is a low-frequency deliberate admin decision, not a high-frequency automatic trigger where spam is a risk. New `lib/verification-notifications.ts` (`getOperatorEmails`, unfiltered so it includes the owner, unlike `lib/invites.ts#listManagers`; `verificationDecisionEmailHtml`, which links `verified` to the public truck page but `rejected`/`onHold` to the dashboard instead, since a non-verified truck's public page 404s) and `notifyOperatorsOnVerificationDecisionFunction` (`inngest/functions.ts`), same load-truck/load-recipients/`Promise.allSettled`-send shape as the other two Inngest email consumers. No schema change, no migration. See `/docs/features/truck-verification.md#operator-notification`. Manually verified end-to-end against the real Neon dev DB with a running Inngest Dev Server: a throwaway script called all three (`rejectTruck`/`holdTruck`/`verifyTruck`) against the seeded Taco Kings truck and restored its original status afterward; the Inngest dev log confirmed all three `app/truck.verification-decided` events fired with the correct payloads and the function ran for each; the app log showed a real `sendEmail` → real Resend API call attempted for each, failing only on the already-documented Resend sandbox constraint (`/docs/features/email.md`: the shared test domain can only deliver to the account's own registered address until a domain is verified) — confirming the code path is fully wired, and (via the `206`, not `500`, response) that one failed send genuinely doesn't fail the whole run even against the real Resend API, not just in mocked unit tests. **With this, every item on the entire `future-plans/roadmap.md` list is closed.** **This session (2026-08-18)** was the app's first real design pass — until now every screen was the unmodified shadcn/ui grayscale scaffold with zero brand identity (confirmed by direct inspection: pure grayscale oklch tokens, only 2 shadcn components installed, no `public/` directory, no logo/favicon anywhere). User-reported starting point: the map popup was white-on-white/unreadable in dark mode, and star ratings everywhere showed one static glyph regardless of the actual rating. Root-caused both, then did the requested full audit and proposed a real direction — see `/docs/features/design-system.md` for the complete token/component reference; this is a summary. **Direction ("Order Window")**: a palette and type system grounded in the physical objects of a food truck order (parchment, ink, a marigold/salsa/basil accent trio) rather than a generic app look, self-checked against the three common AI-design defaults (cream+serif+terracotta / near-black+single-neon-accent / broadsheet-hairlines) and diverging from all three — deliberately light-mode-primary (justified: food photography reads best on a light neutral, and this is an outdoor daytime mobile app), Anton (condensed stencil grotesk) for the wordmark/headlines only, never body text. **Built phase 1**: the token system in `globals.css` + Anton/Geist Mono wired in `layout.tsx`; a shared `StarRating` component (pure, unit-tested fill logic) swapped into all 5 rating call sites app-wide (feed, truck detail ×2, account, admin) — this was a real bug, not just styling, since none of those five previously looped over 5 stars at all; a shared `TicketCard`/`.ticket-card` motif (a dotted-perforation "order ticket" card, colors fixed to Griddle-on-Paper rather than the theme tokens) applied to the map popup, feed cards, and truck-list rows — the map popup fix specifically strips Mapbox's own hardcoded-white popup chrome down to just positioning and hands rendering fully to `.ticket-card`, which is what actually fixes the reported contrast bug (it no longer depends on `--foreground`, the token that broke in dark mode); plus a full pass on the home/discovery page (heading, Map/List toggle, all four filter-button active states) and the truck detail page (heading, Verified badge recolored to Basil, Get Directions recolored to Salsa) and the nav wordmark. Admin and account screens got the `StarRating` bug fix only, deliberately not the `TicketCard` treatment — phase 2, per the scope agreed with the user before building. **New this session**: real component-testing infra (`@testing-library/react` + `jsdom` + `@testing-library/jest-dom`, added at the user's explicit choice over pure-logic-only tests) — opts in per-file via a `// @vitest-environment jsdom` docblock rather than flipping the existing suite's global `node` environment, so none of the existing 42 test files changed environment. **Verification**: all 498 unit tests pass (up from 491 — 7 new `StarRating` tests), `type-check` clean, and real page renders captured via headless Chrome (`google-chrome --headless --blink-settings=preferredColorScheme=0|1`, since the extension-based browser tool wasn't connected this session) for `/`, `/feed`, and `/trucks/taco-kings` in both light and dark mode — confirmed the exact dark-mode scenario that caused the original bug report (white-on-white) now renders with full contrast throughout. **Not directly verified**: the map popup itself couldn't be click-tested live (headless Chrome's software WebGL fallback didn't render the Mapbox canvas reliably, and a single-shot headless screenshot can't simulate a marker click) — confidence instead comes from (a) the root-cause fix being surgical and reasoned through directly (Mapbox's own CSS no longer supplies any color, `.ticket-card` supplies all of it), and (b) the identical `.ticket-card` CSS already being visually proven correct, in both themes, on the feed and truck-list cards that use the exact same classes. **Not yet done** (see `/docs/features/design-system.md`'s "Scope — what's phase 2"): dashboard, admin screens beyond the rating fix, account page layout, forms, empty/error states, the menu-item filter-tag pills (still plain gray, untouched), and a favicon/OG image (still none — no `apps/web/public/` directory exists at all). **This session (2026-08-19)**: `pnpm lint` was fixed (was non-functional, dropping into an interactive wizard — see below) and read-only public **demo mode** was built (`NEXT_PUBLIC_DEMO_MODE`, a shared `<SignedInSafe>` wrapper, no Clerk wiring at all on the demo deployment — see `/docs/features/demo-mode.md`). The real domain (**chompftf.com**) was filled in across `.env.example`/`go-live-requirements/launch-sprint.md`. Vercel CLI access was set up (`npx vercel`, authenticated, team `juicebox-engineering`) and used to audit + fix both existing Vercel projects' env vars (`chomp-production`, `chomp-demo` — see below for exactly what was found/fixed). **The first production deploy surfaced a real outage**: every DB-touching route 500'd due to a classic Prisma-on-Vercel-in-a-pnpm-monorepo bug (the query engine binary never made it into the deployed function) — root-caused and fixed with Prisma's own `@prisma/nextjs-monorepo-workaround-plugin` after two other fixes (`binaryTargets` alone; then `outputFileTracingRoot` + `serverExternalPackages`) both failed against real deploys. `chomp-production` (https://chomp-production.vercel.app, not yet bound to the chompftf.com custom domain) is now live and verified: homepage/feed/sign-in/truck-detail all 200, real seeded data rendering ("Taco Kings"), no runtime errors in `vercel logs`. **Open question, not yet resolved**: it's not confirmed whether `chomp-production`'s `DATABASE_URL` actually points at a separate production Neon branch as originally planned, or still at the same dev database (the "Taco Kings" truck rendering is consistent with either) — worth confirming next session before real users touch it. `chomp-demo` was **not** deployed or tested this session — almost certainly has the same latent Prisma bug (now fixed in committed code, so its first deploy should be clean, but unverified). See "This session (2026-08-19)" below for the full blow-by-blow.

---

## What Was Decided This Session

### Product
- Food truck tracking app for both operators and customers
- National scale target
- Location updates every ~30 minutes (trucks are mostly stationary during service)
- Operators: manage truck profile, GPS/manual location, weekly schedule, menu, events
- Customers: discover trucks, leave reviews, upload food photos
- Public feed: recent high-rated reviews + popular photos

### Tech Stack (fully resolved)
- **Framework**: Next.js 15 (App Router) + TypeScript strict
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Database**: PostgreSQL 18 + PostGIS on Neon (US West 2)
- **ORM**: Prisma 6 — `$queryRaw` for PostGIS geospatial queries only
- **Cache**: Redis (location/feed caching — not yet wired up)
- **Background Jobs**: Inngest (wired up 2026-08-05 — daily feed refresh, see "This session" below)
- **Auth**: Clerk (not yet wired up)
- **Email**: Resend (not yet wired up)
- **Maps**: Mapbox GL JS (not yet wired up)
- **Storage**: Cloudflare R2 + Cloudflare Images — code wired up this session (R2 as
  transient upload intake, Cloudflare Images as the permanent store), needs real
  credentials to actually run
- **Payments**: Stripe (future)
- **Monitoring**: Sentry (not yet wired up)
- **Mobile**: React Native + Expo (future phase)
- **Monorepo**: pnpm workspaces + Turborepo
- **Node**: 24.15.0
- **Deployment**: Vercel (web app)

---

## Repository Structure
```
Chomp/
├── apps/
│   └── web/                  # Next.js 15 app (App Router)
├── packages/
│   ├── db/                   # Prisma schema, migrations, db client singleton
│   │   └── prisma/
│   │       └── migrations/   # ✅ All five migrations applied to Neon
├── packages/
│   ├── types/                # Shared TypeScript types
│   └── utils/                # Shared utility functions
├── docs/
│   ├── README.md             # Documentation table of contents
│   └── architecture/
│       ├── stack.md          # Tech stack decisions
│       └── schema.md         # Full DB schema with design notes
├── future-plans/
├── known-issues/
├── go-live-requirements/
├── CLAUDE.md                 # AI behavior rules
├── HANDOFF.md                # This file
├── .env.example              # All required env vars documented
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Resuming Locally — Do These Steps In Order

### 1. Clone and install
```bash
git clone <repo-url>
cd Chomp
asdf install         # installs Node 24.15.0 from .tool-versions (if using asdf)
# or: nvm use       # switches to Node 24.15.0 via .nvmrc (if using nvm)
pnpm install
```

### 2. Set up environment variables
```bash
cp .env.example apps/web/.env.local
```
**Must go in `apps/web/.env.local`, not the repo root** — Next.js only reads
`.env*` files from its own project directory (wherever `next.config.ts`
lives), so a root-level `.env.local` is silently ignored by `next dev`/
`next build`. Learned this the hard way in the 2026-08-03 session; see "This
session" notes below.

Fill in `apps/web/.env.local` with at least:
- `DATABASE_URL` — Neon pooled connection string
- `DIRECT_URL` — Neon direct connection string (required for Prisma migrations)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — required even to
  render; see Open Items below
- `NEXT_PUBLIC_MAPBOX_TOKEN` — required for the map view

Both Neon URLs are available in the Neon dashboard under **Connect →
Connection string**. Toggle "Pooled connection" on/off to get each one.

Separately, `packages/db/.env` needs its own `DATABASE_URL` / `DIRECT_URL` —
that's what the Prisma CLI reads when you run migration commands directly
from `packages/db` (see step 3). It's a different file from
`apps/web/.env.local`; both need the same two values.

### 3. Apply migrations (already run — Neon DB is live)
Migrations are committed and the Neon database is already in sync.
For a fresh environment or new developer, run:
```bash
cd packages/db
pnpm db:migrate
```
Prisma will detect the existing migrations and apply them in order. No manual SQL needed.

> **Note:** The Neon DB already has all five migrations applied (confirmed
> 2026-08-03). Only run this if you're setting up a brand new database.

### 4. Start the dev server
```bash
pnpm dev
```

---

## Open Items (next things to build)
1. ~~Configure a real Clerk app~~ — **done in a prior session**; publishable/secret
   keys are live in `apps/web/.env.local` and verified working (see "This session"
   below). Webhook endpoint/signing secret still worth double-checking against the
   real Clerk dashboard config before launch.
2. ~~Get a Mapbox token~~ — **done**; `NEXT_PUBLIC_MAPBOX_TOKEN` is live and verified
   against the real Geocoding API.
3. ~~Apply two migrations~~ — **done this session**, see Migrations table below.
   Both are now applied to the Neon dev DB (`prisma migrate deploy`, confirmed with
   `prisma migrate status` — no drift).
4. ~~Set up Cloudflare R2 + Images~~ — **done**; bucket (`chomp-uploads`) exists,
   `CLOUDFLARE_R2_*` and `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_IMAGES_ACCOUNT_HASH` are
   live and verified working (S3-signed request to R2, Cloudflare Images API call).
   Still not done: the lifecycle rule auto-expiring un-finalized uploads (~24h) —
   nothing in the app cleans those up. See `/docs/features/photo-upload.md`.
5. ~~Narrow the Cloudflare R2 API token's scope to `chomp-uploads` only~~ —
   **done 2026-08-04**, see "This session" below.
6. ~~Seed the dev DB~~ — **done 2026-08-04**, see "This session" below.
7. ~~Set `CRON_SECRET` and point a scheduler at the feed refresh~~ — **done
   differently, 2026-08-05**: replaced with an Inngest-scheduled function
   instead of a Vercel-Cron-style route; see "This session" below and
   `/docs/features/feed.md`. Still needs an Inngest Cloud app + sync once
   actually deployed — see item 17 below.
8. ~~Account deletion / erasure handling~~ — **done 2026-08-11**, see "This session
   (2026-08-11, account erasure)" below and `/docs/features/account-erasure.md`.
9. ~~Review submission rate limiting~~ — **done 2026-08-04**, see "This session"
   below. ~~Real moderation queue~~ — **done 2026-08-05**, see "This session"
   below and `/go-live-requirements/reviews.md`.
10. ~~Operator dashboard truck-creation rate limiting~~ — **done 2026-08-04**.
    ~~Manager-invite flow~~ — **done 2026-08-07**. ~~Ownership transfer~~ —
    **done 2026-08-10**, see "This session" below. Truck deletion still open,
    see `/go-live-requirements/operator-dashboard.md`.
11. ~~Photo upload upload-slot rate limiting~~ — **done 2026-08-04**. ~~R2
    lifecycle rule~~ — **done 2026-08-07**, see "This session" below and
    `/go-live-requirements/photo-upload.md`.
12. **Feature development after this** — every major feature in the original
    product scope now has at least a first pass built. What's left is mostly
    the go-live gaps above, plus anything net-new the user wants to add.
13. ~~Truck verification (prevent fake truck accounts)~~ — **done 2026-08-04**,
    see "This session" below and `/docs/features/truck-verification.md`. No
    admin users exist yet in the seeded dev DB — see "Not yet done" in that
    session's notes.
14. **Operator notification on verification decisions** — deliberately
    deferred (no Resend integration yet to hang it off of), see
    `/docs/features/truck-verification.md`'s "Deliberately deferred" section.
15. ~~Review moderation queue~~ — **done 2026-08-05**, see "This session"
    below and `/docs/features/reviews.md`'s "Moderation queue" section.
16. ~~Feed refresh scheduler~~ — **done 2026-08-05** (code-complete), see
    "This session (2026-08-05, feed refresh scheduler)" below and
    `/docs/features/feed.md`.
17. **Sync the Inngest app once deployed** — the daily feed-refresh function
    only runs locally right now (via the Inngest Dev Server). Production
    activation needs: deploy to Vercel, create an Inngest Cloud app, set real
    `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` in Vercel's env vars (not
    `INNGEST_DEV`), and sync the deployed `/api/inngest` URL with Inngest
    Cloud.
18. ~~Truck deletion~~ — **done 2026-08-10**, see "This session (2026-08-10,
    truck deletion)" below. With this, every item on the "operational
    completeness" roadmap list (`future-plans/roadmap.md` item 3) is done.
19. ~~Account page, Phase 1 (profile details + reviews)~~ — **done
    2026-08-10**, see "This session (2026-08-10, account page)" below and
    `/docs/features/account.md`.
20. ~~Account page, Phase 2 (favorites)~~ — **done 2026-08-10**, see
    "This session (2026-08-10, favorites)" below and
    `/docs/features/account.md#favorites`. With this, the account page's
    full original vision is built.
21. ~~Account deletion / erasure handling~~ — **done 2026-08-11**, see "This
    session (2026-08-11, account erasure)" below and
    `/docs/features/account-erasure.md`. With this, every item on the
    original numbered Open Items list is done.
22. ~~Mobile-first nav (roadmap item 6)~~ — **done 2026-08-12**, see "This
    session (2026-08-12, mobile nav)" below and
    `/docs/features/navigation.md`. With this, every item on the whole
    `future-plans/roadmap.md` list is closed.
23. ~~Location freshness / "Active now" (roadmap item 0)~~ — **done
    2026-08-13**, see "This session (2026-08-13, location freshness)" below
    and `/docs/features/operator-dashboard.md#location-updates`.
24. ~~Nearby-trucks list view + filter/sort (roadmap item 0b)~~ — **done
    2026-08-13**, same day, see "This session (2026-08-13, nearby list
    view)" below and `/docs/features/map.md#list-view`.
25. **A second product gap-analysis pass, roadmap item 7** (a-h) — see "This
    session (2026-08-13, gap-analysis + get directions)" below. ~~b, "Get
    Directions"~~ — **done 2026-08-13**. ~~g, "my favorites" filter~~ and
    Resend plumbing (prerequisite for d/h) — **done 2026-08-16**. ~~d,
    favorites × freshness notifications~~ — **done 2026-08-16**. ~~a,
    special events~~ — **done 2026-08-17**, see "This session (2026-08-17,
    events)" below and `/docs/features/events.md`. ~~c, customer content
    reporting~~ — **done 2026-08-17**, same day, see "This session
    (2026-08-17, content reporting)" below and
    `/docs/features/content-reporting.md`. ~~e, search by name/city/zip~~ —
    **done 2026-08-17**, same day, see "This session (2026-08-17, search)"
    below and `/docs/features/search.md`. ~~f, "Open now" indicator~~ —
    **done 2026-08-17**, same day, see "This session (2026-08-17, open
    now)" below and `/docs/features/truck-detail.md`. ~~h, operator
    notification on verification decisions~~ — **done 2026-08-17**, same
    day, see "This session (2026-08-17, verification notifications)" below
    and `/docs/features/truck-verification.md#operator-notification`.
    **Every item on the whole `future-plans/roadmap.md` list is now
    closed.**
26. ~~`pnpm lint` non-functional~~ — **done 2026-08-19**, see "This session
    (2026-08-19)" below. Real `eslint.config.mjs` added; 11 errors + 2
    warnings it surfaced are all fixed.
27. ~~Stale `operator-dashboard.md` line (image upload)~~ — **done
    2026-08-19**, same session.
28. ~~Read-only public demo deployment~~ — **done 2026-08-19**, see "This
    session (2026-08-19)" below and `/docs/features/demo-mode.md`.
29. **Deploy `chomp-demo` and verify it** — code should be clean (the
    Prisma fix below is already committed), but this deployment itself was
    never actually triggered or smoke-tested this session.
30. **Confirm what DB `chomp-production`'s `DATABASE_URL` actually points
    at** — never explicitly verified whether it's a real separate
    production Neon branch (the original plan) or still the shared dev
    database. Do this before real users touch the production site.
31. **Bind the `chompftf.com` custom domain** to the `chomp-production`
    Vercel project (currently only live at
    `chomp-production.vercel.app`) and `demo.chompftf.com` to
    `chomp-demo` — neither domain is attached yet, only the env vars
    reference them.
32. **Set `RESEND_FROM_EMAIL`** on `chomp-production` once `chompftf.com`
    is verified in Resend — still on the sandbox fallback address.
33. **Clean up the Turborepo env-var warning** — `turbo.json` doesn't
    declare the server-only secrets (`DATABASE_URL`, `CLERK_SECRET_KEY`,
    Cloudflare/Upstash/Resend/Inngest/Sentry vars) in its `env` field, so
    Vercel builds print a "may cause your build to fail" warning every
    time. Confirmed harmless for this session's deploys (loose envMode,
    runtime reads `process.env` directly regardless of Turbo's cache
    hashing) but worth silencing properly at some point.

## This session (2026-08-19, lint/doc fixes, demo mode, first prod deploy)

Four things got done, in order: fixed `pnpm lint` and a stale doc line
(quick cleanup), built demo mode (a whole feature), filled in the real
domain, then set up Vercel CLI access and used it to audit env vars and
run the actual first production deploy — which surfaced and required
fixing a real outage. Full detail below; `docs/features/demo-mode.md` is
the canonical reference for the demo-mode feature itself.

### Lint config + stale doc fix
`next lint` was dropping into an interactive "no ESLint config found"
wizard even non-interactively, so it never actually ran. Added the
standard Next.js flat config (`eslint.config.mjs`, `eslint`/
`eslint-config-next`/`@eslint/eslintrc` as new devDependencies — had to
pin `eslint@^9`/`eslint-config-next@15` specifically, since the
unpinned install pulled `eslint@10`/`eslint-config-next@16`, which are
incompatible with each other). Fixed everything it then surfaced: 11
`react/no-unescaped-entities` errors (apostrophes → `&apos;` across 7
files) and 2 warnings — one genuine, one a real false positive
(`TruckMap`'s marker-ref cleanup: `renderMarkers` reassigns
`markersRef.current` to a new array rather than mutating in place, so
the "textbook" fix of copying the ref value out of the cleanup closure
would have leaked stale markers; suppressed with an explanatory
comment instead of blindly applying the rule's suggested fix). Also
fixed a stale line in `go-live-requirements/operator-dashboard.md`
still claiming image upload was blocked on Cloudflare — shipped long
ago.

### Demo mode
Built at the user's request: a second, read-only public deployment
(`demo.chompftf.com`, separate Vercel project + separate Neon
database) so people can look around before signing up, with a
persistent "sign up on the real app" CTA rather than a working
account system of its own. Scoping questions asked and answered via
`AskUserQuestion`: browse-only (no accounts on demo itself, not a
resettable sandbox with its own signups) and a `demo.` subdomain
(not a bare `*.vercel.app` URL).

Core mechanism: `NEXT_PUBLIC_DEMO_MODE=true` on the demo deployment
only. When set, **no Clerk wiring exists at all** — not stubbed, not
no-op'd, genuinely absent: `app/layout.tsx` skips `<ClerkProvider>`,
`middleware.ts` skips `clerkMiddleware` entirely (routes needing an
account — `/sign-in`, `/sign-up`, `/dashboard`, `/account`, `/admin` —
redirect to `NEXT_PUBLIC_SIGNUP_URL` instead), and
`lib/auth.ts#getCurrentUser` short-circuits to `null` before ever
calling Clerk's `auth()`. This means the demo deployment needs zero
Clerk credentials configured.

Every place that used to render Clerk's `<SignedIn>` directly for a
write affordance (favoriting a truck/menu item, reporting content, the
event-notify toggle, the truck-list favorite button) now goes through
a new shared `<SignedInSafe>` wrapper (`components/signed-in-safe.tsx`)
that renders nothing in demo mode instead of throwing "must be wrapped
in ClerkProvider". Two spots get a real CTA instead of just
disappearing, since disappearing there would be a dead end: the nav
header's sign-in button and the "sign in to write a review" prompt on
the truck detail page. A persistent banner
(`components/demo-banner.tsx`) reminds visitors they're on sample
data.

**Building this caught its own regression**: the first pass only
covered the components found by grepping for `SignedOut`/`useUser`/
`auth()`, which missed four more files using bare `<SignedIn>`
(`report-button.tsx`, `truck-menu.tsx`, `truck-list.tsx`,
`truck-event-notify-toggle.tsx`) — found by actually running a demo-mode
dev server (`NEXT_PUBLIC_DEMO_MODE=true next dev`) and hitting
`/trucks/taco-kings`, which threw the exact "must be wrapped in
ClerkProvider" error live. This is why `<SignedInSafe>` exists as a
shared component rather than four more one-off `isDemoMode()` branches
— closes off the same class of regression happening again. Verified
via curl against both a demo-mode dev server (banner shows, CTAs point
at the configured signup URL, `/dashboard`/`/account`/`/admin` redirect
307, no Clerk references in the rendered HTML) and, separately, the
normal Clerk-enabled dev server (confirmed unaffected — same
`clerkMiddleware(...)` call, byte-identical to the pre-session code).

15 new/updated tests (509 total passing), lint clean, `@chomp/web`
type-check clean (the one remaining failure across the whole repo is
the pre-existing, already-documented `packages/utils`
`dashboard-tabs.test.ts` `noUncheckedIndexedAccess` issue, unrelated).
Two commits: lint/doc fixes, then demo mode + the `chompftf.com` domain
fill-in (`.env.example`, `go-live-requirements/launch-sprint.md`, plus
a new "Demo deployment" section there documenting its env vars).

### Vercel CLI access + env var audit
User set up two Vercel projects themselves from the dashboard
(`chomp-production`, `chomp-demo`, team `juicebox-engineering`) and
asked to verify the env vars were right. No Vercel MCP/CLI was
available yet — installed via `npx vercel` (no global install needed)
and authenticated via the CLI's own device-auth flow (`npx vercel
login`, browser confirmation). `vercel link --project <name>` swaps
which project subsequent `vercel env`/`vercel deploy` commands target
from this same repo checkout; `.vercel/` and the root `.env.local` it
creates (just a `VERCEL_OIDC_TOKEN`, unrelated to the app's own env
vars) are both gitignored.

Audit findings (names/environments only, never values — per this
repo's own env-vars skill rule):
- **`chomp-production`**: missing `NEXT_PUBLIC_APP_URL` (emails would
  have linked to `localhost:3000`); `INNGEST_DEV` was set alongside
  real `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` (the Inngest SDK reads
  `INNGEST_DEV` directly and treats its presence as "route to my local
  dev server," which doesn't exist in production — would have silently
  broken the feed-refresh cron and all 3 email notifications); missing
  `RESEND_FROM_EMAIL` (expected/not urgent, blocked on Resend domain
  verification, see Open Item 32).
- **`chomp-demo`**: missing `NEXT_PUBLIC_DEMO_MODE` entirely — meaning
  this deployment was **actively broken** (would try to run as a
  normal Clerk-enabled app with zero Clerk keys configured, crashing
  every page) until fixed; missing `NEXT_PUBLIC_SIGNUP_URL`;
  unnecessary (harmless but pointless) `INNGEST_DEV`.

Fixed everything fixable via `vercel env add`/`rm` (added
`NEXT_PUBLIC_APP_URL` to `chomp-production`; added
`NEXT_PUBLIC_DEMO_MODE`/`NEXT_PUBLIC_SIGNUP_URL` to `chomp-demo`;
removed `INNGEST_DEV` from both — the `rm` on `chomp-production`
specifically got blocked once by an auto-mode safety classifier,
retried successfully once linked back to it). Confirmed via `vercel
env ls` after. `RESEND_FROM_EMAIL` genuinely can't be set yet (Open
Item 32).

### First production deploy — found and fixed a real outage
User asked for a `chomp-production` redeploy to pick up the env var
fixes above. First deploy succeeded (`READY`) but `curl`-ing the live
site returned 500 on every DB-touching route. Root cause, via `vercel
logs`: `PrismaClientInitializationError: could not locate the Query
Engine for runtime "rhel-openssl-3.0.x"` — a well-known class of bug
(Prisma + pnpm monorepo + Vercel), not something introduced this
session, just never previously deployed/discovered.

Took three real attempts to actually fix, each verified (or
disproven) against a real deploy:
1. `binaryTargets = ["native", "rhel-openssl-3.0.x"]` in
   `packages/db/prisma/schema.prisma` — necessary (this is why the
   local dev machine's `prisma generate` wasn't already producing the
   right engine) but not sufficient on its own; redeployed, same error.
2. `outputFileTracingRoot` (pointed at the monorepo root) +
   `serverExternalPackages: ['@prisma/client', '.prisma/client']` in
   `next.config.ts` — still the same error on redeploy.
3. **What actually worked**: `@prisma/nextjs-monorepo-workaround-plugin`
   — Prisma's own official webpack plugin, purpose-built for exactly
   this. Switched to it instead of continuing to guess at generic
   Next.js config flags. Needed a hand-written `.d.ts` shim
   (`apps/web/types/prisma-nextjs-monorepo-workaround-plugin.d.ts`,
   the package ships no types).

For this last one, verified **locally** before burning another prod
deploy cycle: `vercel pull --environment production` + `vercel build
--prod` reproduces Vercel's exact build/packaging locally without
needing a live deploy per iteration. Confirmed, in order, that the
plugin actually closes the gap: `.next/server/chunks/` and
`.next/server/app/trucks/[slug]/` physically contain
`libquery_engine-rhel-openssl-3.0.x.so.node` after the build;
`.next/server/app/page.js.nft.json` (Next's own file-trace manifest)
lists it, where it hadn't before; and `vercel build`'s own packaged
output (`.vercel/output/functions/index.func/.vc-config.json`) maps to
it at a path that verifiably exists on disk.

One more wrinkle: deployed this validated build via `vercel deploy
--prebuilt --prod` first, which broke a *different* thing — Clerk
threw "Publishable key not valid" on every route, even though sign-in
had returned 200 on every prior deploy. Root cause not fully chased
down, but the fix was simple and low-risk: don't trust a locally-run
`vercel build`'s env-var baking for `NEXT_PUBLIC_*` values, just
redeploy normally (`vercel deploy --prod`, no `--prebuilt`) so
Vercel's own cloud build injects them the same way it always had.
That resolved it immediately.

**Final state, verified**: `chomp-production`
(https://chomp-production.vercel.app — **not yet** bound to the real
`chompftf.com` custom domain, see Open Item 31) returns 200 on `/`,
`/feed`, `/sign-in`, `/trucks/taco-kings`; the homepage renders real
seeded data ("Taco Kings"); `vercel logs` shows no errors. All 4
commits from this whole session are in `main`; nothing left
uncommitted. `chomp-demo` was **not** deployed or tested this session
— see Open Item 29.

## This session (2026-08-18, design pass — phase 1)

The app's first real visual design pass. Full details in
`/docs/features/design-system.md`; this is a summary.

- **Starting point** (confirmed by direct inspection, not assumed):
  `globals.css` was the unmodified shadcn/ui scaffold — every color token
  pure grayscale oklch, only `button.tsx`/`sheet.tsx` installed under
  `components/ui/`, Geist the only font (aliased to the heading font too),
  no `apps/web/public/` directory at all (no logo/favicon/brand asset
  anywhere). Zero brand identity, a genuinely blank canvas.
- **Two user-reported bugs, root-caused first**:
  - Map popup unreadable in dark mode: Mapbox's vendored CSS hardcodes
    `.mapboxgl-popup-content`'s background to `#fff` and sets no text
    color, so popup text fell back to inheriting `--foreground`, which
    flips to near-white in dark mode — white text on a white card.
  - Star ratings always showed one static glyph: there was no
    `<StarRating>` component anywhere. Every one of 5 call sites (feed,
    truck detail's summary + list, account, admin) just printed
    `"{rating} ★"` — a number next to a single hardcoded star, never a
    loop over 5.
- **Direction — "Order Window"**, approved by the user via
  `AskUserQuestion` before any code was written (per `CLAUDE.md`'s "plan
  first" rule): a palette/type system grounded in the physical objects of
  a food truck order (parchment, ink, a marigold/salsa/basil accent trio)
  rather than a generic app look. Self-checked against the three common
  AI-design defaults (cream+serif+terracotta / near-black+single-neon /
  broadsheet-hairlines) and diverges from all three — light-mode-primary
  is a deliberate choice (food photography reads best on a light neutral;
  this is an outdoor daytime mobile app), Anton (condensed stencil
  grotesk) reserved for the wordmark/headlines only, never body text or
  buttons.
- **Built**: the token system in `globals.css` (named brand colors +
  remapped semantic tokens, both light and dark blocks) with Anton/Geist
  Mono wired in `layout.tsx`; `components/ui/star-rating.tsx` (pure,
  unit-tested `getFilledStarCount`) swapped into all 5 call sites;
  `components/ui/ticket-card.tsx` + the `.ticket-card`/
  `.ticket-card__perforation` CSS classes (a dotted perforation line
  standing in for a literal torn-edge cutout, since a true CSS mask
  couldn't know the color behind the card — most visibly true of the map
  popup, which sits over live Mapbox tiles) applied to the map popup, feed
  cards, and truck-list rows; a full pass on the home/discovery page
  (heading, Map/List toggle, all four filter-button active states — all
  previously hardcoded `bg-gray-900`) and the truck detail page (heading,
  Verified badge recolored to Basil, Get Directions recolored to Salsa);
  the nav wordmark. The map-popup fix itself: Mapbox's own popup chrome is
  stripped down to just positioning (background/padding/shadow zeroed out)
  and rendering is handed fully to `.ticket-card`'s fixed colors, which no
  longer depend on `--foreground` — the token that broke in dark mode.
- **Scoped deliberately smaller than "the whole app"**: admin and account
  screens got the `StarRating` bug fix only, not the `TicketCard` visual
  treatment — agreed with the user up front as phase 2, so a full-app
  redesign wasn't attempted blind before confirming the direction landed.
- **New this session**: real component-testing infra
  (`@testing-library/react` + `jsdom` + `@testing-library/jest-dom`),
  chosen by the user via `AskUserQuestion` over a pure-logic-only-tests
  alternative. Opts into `jsdom` per test file via a
  `// @vitest-environment jsdom` docblock rather than flipping the
  existing suite's global `node` environment, so none of the pre-existing
  42 test files changed environment.
- **Verification**: all 498 unit tests pass (491 pre-existing + 7 new
  `StarRating` tests, all passing, zero regressions), `pnpm type-check`
  clean. The Claude-in-Chrome browser extension wasn't connected this
  session, so real page renders were instead captured via headless Chrome
  (`google-chrome --headless --blink-settings=preferredColorScheme=0|1`)
  for `/`, `/feed`, and `/trucks/taco-kings` in both light and dark mode —
  confirmed the exact dark-mode scenario that caused the original bug
  report (white-on-white) now renders with full contrast throughout, and
  that `StarRating` correctly renders a partial fill (e.g. 4 of 5) rather
  than the old single-glyph bug.
- **Not directly verified**: the map popup itself couldn't be click-tested
  live — headless Chrome's software WebGL fallback didn't reliably render
  the Mapbox canvas, and a single-shot headless screenshot can't simulate
  a marker click. Confidence instead comes from (a) the root-cause fix
  being surgical and directly reasoned through (Mapbox's CSS no longer
  supplies any color at all; `.ticket-card` supplies 100% of it), and (b)
  the identical `.ticket-card` CSS already being visually proven correct,
  in both themes, on the feed and truck-list cards using the same classes.
- **Not yet done** (phase 2, see `/docs/features/design-system.md`'s
  final section): dashboard, admin screens beyond the rating fix, account
  page layout, forms, empty/error states, the menu-item filter-tag pills
  (still plain gray, untouched), and a favicon/OG image (still none — no
  `apps/web/public/` directory exists at all).

## This session (2026-08-17, verification notifications)

Scoped and built roadmap item 7h, operator notification on verification
decisions — **the last open item on the entire roadmap**. Full details in
`/docs/features/truck-verification.md#operator-notification`; this is a
summary.

- **Scoping** (via `AskUserQuestion`, all recommended options chosen):
  recipients are every operator on the truck (owner + managers, not just
  the owner); all three admin decisions trigger it (verify, reject, *and*
  hold — not just the bad-news cases); always-on with no opt-in
  preference, unlike this app's other two email consumers, since this is
  core status info an operator shouldn't be able to silently miss.
- **Built**: `lib/verification-notifications.ts` (new —
  `getOperatorEmails`, deliberately unfiltered by role so it includes the
  owner, unlike `lib/invites.ts#listManagers`'s manager-only list;
  `verificationDecisionEmailHtml`, three copy variants, `verified` linking
  to the public truck page and `rejected`/`onHold` linking to the
  dashboard instead since a non-verified truck's public page 404s).
  `verifyTruck`/`rejectTruck`/`holdTruck` (`lib/trucks.ts`) each fire a new
  `app/truck.verification-decided` Inngest event after their write.
  `notifyOperatorsOnVerificationDecisionHandler`/`...Function`
  (`inngest/functions.ts`), same load-truck/load-recipients/
  `Promise.allSettled`-send shape as the two existing email consumers
  (favorite-activation, new-event), registered in
  `apps/web/app/api/inngest/route.ts`.
- **Deliberate design choice, different from the other two consumers**: no
  dedup/transition check — every call to `verifyTruck`/`rejectTruck`/`holdTruck`
  notifies, including a re-reject with an updated reason. The
  favorite-activation feature's off→on-only logic exists specifically to
  avoid spamming a high-frequency automatic trigger (location posting);
  this is the opposite shape — a rare, deliberate admin action where the
  content (the reason) may genuinely have changed each time, so always
  notifying is the more correct default, not an oversight.
- **No schema change, no migration** this pass.
- **Verification**: all new/extended unit tests pass (491 in `apps/web`),
  `@chomp/web`/`@chomp/db` type-check clean. Manually verified end-to-end
  against the real Neon dev DB with a running Inngest Dev Server: a
  throwaway script called `rejectTruck`/`holdTruck`/`verifyTruck` in
  sequence against the seeded Taco Kings truck (restoring its original
  `verified` status afterward — no lasting change to seed data); the
  Inngest dev log confirmed all three `app/truck.verification-decided`
  events fired with the correct `{truckId, decision, note}` payloads and
  the new function initialized for each; the app log showed a real
  `sendEmail` call actually reaching the real Resend API for each,
  failing only on the already-documented sandbox constraint (shared test
  domain can only deliver to the account's own registered address) — not
  a bug, and the `206` (not `500`) response confirmed
  `Promise.allSettled`'s "one failed send doesn't fail the run" behavior
  holds against the real API, not just in mocked tests.

## This session (2026-08-17, open now)

Scoped and built roadmap item 7f, the "Open now" indicator — full details
in `/docs/features/truck-detail.md` (the badge itself) and
`/docs/features/operator-dashboard.md#timezone-powers-open-now` (the new
profile field); this is a summary.

- **Discussion first** (the user asked to "talk about and scope out" this
  one specifically): confirmed from the codebase's own docs that "Open
  now" is a distinct, already-reserved concept from "Active now" —
  `operator-dashboard.md` explicitly says the location-freshness feature
  is named "Active now" *specifically* so "Open now" stays free for a
  schedule-based indicator, which is what this session built.
- **Scoping** (via `AskUserQuestion`): timezone source is a manual field on
  the truck profile (not auto-derived from a posted location — no new
  dependency, works immediately at truck creation); display is truck
  detail page only; a truck with no timezone set falls back to exactly the
  existing plain-text schedule display rather than showing a
  guessed/wrong badge.
- **Built**: `packages/utils/src/open-now.ts` (new — `getOpenNowStatus`,
  pure, Intl-based real timezone conversion, also exports
  `getLocalDateParts` so `lib/schedule.ts#getTodaysScheduleEntries` could
  reuse the same "what day/date is it in this truck's zone" primitive
  instead of a second copy), `lib/truck-validation.ts` gained
  `isValidTimezone`, `TruckProfileInput`/`TruckDetail` gained `timezone`,
  threaded through `getTruckForEdit`/`updateTruckProfile`/`getTruckBySlug`,
  `truck-profile-form.tsx` gained a timezone `<select>` (options from
  `Intl.supportedValuesOf('timeZone')` — built-in, zero new dependency,
  same reasoning that ruled out an auto-derivation library), and
  `components/open-now-status.tsx` (new, mirrors `LocationStatus`'s shape)
  wired into the truck detail page.
- **Adjacent bug caught and fixed**: `formatTime` in both the truck detail
  page and `truck-schedule-editor.tsx` rendered stored schedule times via
  `toLocaleTimeString` with no `timeZone` — since those stored values are
  literal wall-clock readings (not real instants), this actually rendered
  using the *server process's own* local timezone, which could disagree
  with what the operator typed depending on server `TZ`. Both call sites
  now pass `timeZone: 'UTC'` explicitly. Found because building precise
  timezone-aware logic right next to this existing display code made the
  latent bug obvious; flagged explicitly as a related fix, not silent
  scope creep.
- **Scope cuts, stated up front**: same-day windows only (an entry
  crossing midnight isn't specially handled — would need to also check
  *yesterday's* dayOfWeek entry after local midnight, real added
  complexity for an edge-case schedule shape); no "opens at X" prediction
  for the closed state (needs a forward scan across days); no map/list
  badge or filter.
- **Migration**: `20260817214106_add_truck_timezone` —
  `trucks.timezone TEXT`, nullable, no default, no backfill. Presented and
  approved before running; applied to the Neon dev DB, `prisma migrate
  status` confirms no drift.
- **Verification**: all new/extended unit tests pass (477 in `apps/web`,
  74 in `packages/utils`, including two-different-timezones-same-instant
  tests proving real conversion), `@chomp/web`/`@chomp/db` type-check
  clean. Manually verified against the real Neon dev DB: a throwaway
  script confirmed `getOpenNowStatus` returns `unknown` before a timezone
  is set, correctly computes `closed` against the seed truck's real
  schedule at the real current moment once `America/Chicago` was set (the
  seed schedule is Tuesday 11am-2pm; "now" was a Monday), and a synthetic
  all-day window proved the positive `open` path also works; a real page
  render via `next dev` + curl confirmed the badge shows once a timezone
  is set and is completely absent (exact prior behavior) once reverted to
  `null`. Timezone reverted afterward — no lasting change to seed data.

## This session (2026-08-17, search)

Scoped and built roadmap item 7e, search by truck name/city/zip — full
details in `/docs/features/search.md` (canonical write-up; this is a
summary).

- **Two findings, surfaced to the user before building** (both changed
  what "search" needed to mean here): `TruckLocation.city`/`state`/`zip`
  exist in the schema but are dead columns (`postLocation` only ever
  writes a free-text `address` — same "planned but never wired" situation
  `TruckEvent` was in before it got built two sessions ago); and the
  discovery page had no unbounded truck lookup at all —
  `getNearbyTrucks` is geolocation-bounded (radius-limited, capped at 100,
  requires a current location row to appear).
- **Scoping** (via `AskUserQuestion`): name search should be a real,
  unbounded server search (not a client-side filter over the already-nearby
  set — the recommended-but-not-chosen lighter option); "city/zip" search
  reinterpreted as re-centering via geocoding rather than a literal text
  match against the empty columns; the search UI lives inside the existing
  map/list controls, not a new global nav search box.
- **Built**: `lib/trucks.ts#searchTrucksByName` (new — unbounded,
  verified/active-only, capped at 20), `app/actions/trucks.ts` gained
  `searchTrucksByNameAction` (unauthenticated, unrate-limited, same
  posture as the existing `getNearbyTrucksAction`) and
  `searchLocationAction` (geocodes via `lib/geocoding.ts`, then the client
  feeds the result through the same `setCenter`/`getNearbyTrucksAction`
  path the geolocation callback already used — no new rendering path for
  location search at all). `components/truck-list-controls.tsx` gained two
  inline forms; `components/truck-discovery.tsx` gained
  `nameSearchResults` state that swaps the Map/List content for a new,
  deliberately lightweight `components/truck-search-results.tsx` (no
  distance/rating/favorite toggle) until cleared.
- **New pattern**: `lib/rate-limit.ts#getClientIp` + a new
  `locationSearchLimiter` — the first IP-keyed rate limiter in the app.
  Every existing limiter keys off a signed-in user id, but
  `searchLocationAction` is the first anonymous-callable action with a
  real per-call cost (a metered Mapbox API request) — this was a genuine
  gap in the original plan text (which had said "no auth needed" for both
  new actions without working through how an unauthenticated caller gets
  rate-limited), caught and resolved during implementation rather than
  left unaddressed.
- **No schema change, no migration** this pass.
- **Verification**: all new/extended unit tests pass (474 total in
  `apps/web`), `@chomp/web`/`@chomp/db` type-check clean (the one
  remaining failure, `packages/utils`' `dashboard-tabs.test.ts`, is the
  same pre-existing, unrelated `noUncheckedIndexedAccess` error confirmed
  during the events session — still untouched). Manually verified against
  the real Neon dev DB: `next dev` + curl confirmed `/` renders both new
  search inputs with no server error; a throwaway script (not committed)
  confirmed a real partial/case-insensitive name match against seeded
  data, the verified-only gate (created and deleted a throwaway
  `pending`-status truck to prove it's excluded from results), and a real
  `geocodeAddress` lookup for "Austin, TX" resolving to real coordinates.

## This session (2026-08-17, content reporting)

Scoped and built roadmap item 7c, customer content reporting — full
details, decisions, and the security/testing rationale are in
`/docs/features/content-reporting.md` (canonical write-up; this is a
summary).

- **Scoping** (via `AskUserQuestion`): reviews **and** photos both get
  reporting (not reviews-only, the recommended default — this doubled the
  pass's scope since photos had zero moderation capability before);
  reports surface through a **separate dedicated `/admin/reports` queue**
  (not folded into `/admin/reviews`); fixed reason categories (spam/
  inappropriate/harassment/other) + optional note; one report per user per
  item.
- **Key finding, surfaced to the user before building**: `ModerationQueueEntry`
  (the existing queue table used for erasure-blocked-by-sole-ownership,
  whose schema comment frames it as generic/reusable) is **not** actually
  safe to reuse for content reports — `resolveModerationEntry`/
  `dismissModerationEntry` hard-code Clerk account deletion/unban/truck-
  reactivation logic specific to the erasure use case. Built a new
  `ContentReport` model instead, structurally similar but with its own
  resolution semantics and no relation to `ModerationQueueEntry` at all.
- **Built**: `lib/reports.ts` (new — `reportReview`/`reportReviewPhoto`
  with own-content + duplicate-report rejection, `getAllContentReports`,
  `resolveContentReport`/`dismissContentReport`), `lib/review-photos.ts`
  gained `setReviewPhotoVisibility` (a direct mirror of
  `lib/reviews.ts#setReviewVisibility` — the first-ever admin moderation
  capability for photos), `app/actions/reports.ts` (new, rate-limited via
  a new `reportLimiter`), `app/actions/admin.ts` gained
  `resolveContentReportAction`/`dismissContentReportAction`, `/admin/reports`
  (new page + `components/admin/report-queue.tsx`, filterable Open/
  Resolved/Dismissed/All, same inline-reason-input pattern as
  `/admin/reviews`), and `components/report-button.tsx` (new, shared by
  both review and photo reports, wired into `components/truck-reviews.tsx`).
- **Design decision**: `setReviewVisibility`/`setReviewPhotoVisibility`
  themselves (not just the report-resolution path) now auto-close every
  open `ContentReport` on an item whenever it's hidden — this means
  `resolveContentReport` doesn't need its own separate "mark this report
  resolved" step (the report being acted on is itself one of the rows that
  update), and the *existing* `/admin/reviews` hide button now also closes
  out any pending reports on a review it hides directly, keeping the two
  moderation entry points from diverging.
- **Migration**: `20260817200058_add_content_reporting` — adds
  `review_photos.moderation_note`/`moderated_by_user_id`/`moderated_at`
  (parity with `reviews`) and the new `content_reports` table + two enums.
  No backfill. Presented and approved before running; applied to the Neon
  dev DB, `prisma migrate status` confirms no drift.
- **Verification**: all new/extended unit tests pass (465 total in
  `apps/web`), `@chomp/web` type-checks clean. Manually verified against
  the real Neon dev DB via two throwaway scripts (not committed, same
  precedent as prior sessions): own-content rejection, duplicate-report
  rejection, a real `reportReview`/`reportReviewPhoto`, `resolveContentReport`
  actually hiding the review and marking the report resolved,
  `dismissContentReport` leaving the photo untouched, and — the one
  behavior worth a dedicated check — the auto-resolve cascade: two open
  reports filed by different users against the same review, resolving one
  via `resolveContentReport` confirmed the *other* also flipped to
  `resolved`. All test data cleaned up afterward. Real page renders
  confirmed via `next dev` + curl: the truck detail page still renders
  correctly with the new `ReviewPhoto` moderation fields in place, and
  `/admin/reports` correctly 404s for a non-admin/anonymous request. **Not
  verified**: the actual `/admin/reports` authenticated view or the
  customer-facing Report button's click flow in a real browser — same
  standing gap as the events session, no documented way to sign in locally
  as a seeded admin/customer without real Clerk credentials.
- **Not built**: a standalone "browse all photos" admin page (photo
  moderation surfaces only through the reports queue, deliberately —
  wasn't asked for and would have been a third scope expansion beyond what
  7c needed), admin notification when a new report comes in (pull-based
  queue, same as every other admin queue in this app).

## This session (2026-08-17, events)

Scoped and built roadmap item 7a, special events — full details, decisions,
and the security/testing rationale are in `/docs/features/events.md`
(that's the canonical write-up; this is a summary).

- **Scoping** (via `AskUserQuestion`, all recommended options chosen):
  display on both the truck detail page and the feed (not map pins);
  geocode the typed address via a new Mapbox Geocoding integration rather
  than skip coordinates; the favoriter notification opt-in lives on the
  truck's own page (not `/account`) and requires already favoriting;
  full CRUD (not create/delete-only); the feed surface is a **live** query,
  not folded into the `feed_items` materialized view (which only refreshes
  daily — would be stale for a same-day announcement); the notify toggle
  requires favoriting first (new `TruckFavorite.notifyNewEvents` column,
  not a standalone subscription table); geocoding auto-accepts the top
  match with no confirm step, and a miss never blocks creation.
- **Built**: `lib/geocoding.ts` (new, Mapbox forward geocoding, reuses
  `NEXT_PUBLIC_MAPBOX_TOKEN`), `lib/events.ts` (new, full CRUD + the
  "upcoming" reads for both the truck page and feed — geom writes go
  through a raw SQL follow-up `UPDATE` after the Prisma `create`, same
  two-step pattern `lib/locations.ts#postLocation` uses), `app/actions/events.ts`
  (new, `requireOperator` + `eventLimiter` rate limiting on create),
  `/dashboard/[truckId]/events` (new tab + editor), `components/truck-events.tsx`
  and `components/truck-event-notify-toggle.tsx` (new, wired into the truck
  detail page), a live "Upcoming Events" block on `/feed`, and a new
  `app/truck.event-created` Inngest event/function pair (mirrors
  `notifyFavoritesOnActivationFunction` almost exactly). `TruckDetail`
  gained `upcomingEvents` and `notifyNewEvents`.
- **Migration**: `20260817184420_add_notify_new_events` —
  `truck_favorites.notify_new_events BOOLEAN NOT NULL DEFAULT false`, no
  backfill. Presented and approved before running; applied to the Neon dev
  DB, `prisma migrate status` confirms no drift. `TruckEvent` itself needed
  no schema change — fully migrated since `20260506222654_init`.
- **Verification**: all new/extended unit tests pass (`apps/web` 432,
  `packages/utils` 66), `@chomp/web`/`@chomp/db` type-check clean (a
  pre-existing, unrelated `noUncheckedIndexedAccess` type error in
  `packages/utils/src/dashboard-tabs.test.ts` predates this session — left
  alone). `pnpm lint` isn't actually usable in this repo yet (`next lint`
  drops into an interactive "no ESLint config found" setup wizard even in a
  non-interactive shell, and its side-effect tsconfig.json rewrite was
  reverted) — a pre-existing gap, not something this session introduced or
  fixed. Manually verified against the real Neon dev DB + a real Inngest
  Dev Server via a throwaway script (not committed, same precedent
  `favorite-notifications.md` set): real Mapbox geocode hit and miss, event
  create/update/delete including the truckId-scoped IDOR check, the
  "upcoming" filter on both reads, the `app/truck.event-created` event
  firing and the notify function running end-to-end (0 recipients — nobody
  had opted in yet), and real HTML renders of `/trucks/taco-kings` and
  `/feed` confirmed the new section and a working Get Directions link. All
  test data cleaned up afterward. **Not verified**: the dashboard editor UI
  and the notify-toggle click in an actual browser — no documented way to
  sign in locally as a seeded operator without real Clerk credentials, so
  those paths only got unit-test + DB-script coverage, not a live click-through.
- **Not built**: map pins for events (deliberately, same reasoning Get
  Directions/7b used to skip the map's raw-DOM popups), a geocoding
  confirm/disambiguation step, recurring events.

## This session (2026-08-16, favorites filter + Resend plumbing)
- **Scoped two of roadmap item 7's smaller, previously-unscoped gaps** (g and
  the Resend prerequisite for d/h) with the user, then built both. Full
  scoping discussion and rejected alternatives are in
  `future-plans/roadmap.md`'s "Product gap-analysis findings" section and
  `/docs/features/map.md`/`/docs/features/email.md`; not repeated here.
- **Item 7g, "show only my favorites" filter** — most of the groundwork
  (`isFavorited` on `TruckMapMarker`, `viewerId` threaded end-to-end through
  `TruckDiscovery`) already existed from the 0b list-view session; this
  session added `hasFavoritedMenuItem` (an `EXISTS` subquery in
  `getNearbyTrucks`, not a `JOIN` — a `JOIN` against `menu_items` would fan
  out one row per menu item per truck and break the query's
  one-row-per-truck cardinality), the pure `filterTrucksByFavorite`
  (`@chomp/utils/truck-list-filters.ts`), and a signed-in-only toggle in
  `TruckListControls`. Deliberately did **not** redefine `isFavorited` to
  include menu-item favorites — that would've made the truck-level favorite
  toggle button silently no-op whenever a truck was only ever favorited via
  one of its items. Also deliberately did **not** auto-favorite a truck when
  a menu item is favorited (a user idea raised mid-session) — rejected
  because unfavoriting the item would leave ambiguous truck-favorite state,
  and it would dilute `/account`'s explicit-favorites list.
- **Resend plumbing** — `apps/web/lib/email.ts`'s `sendEmail()`, modeled on
  `lib/storage.ts`'s lazily-constructed-client pattern. New `resend` npm
  dependency in `apps/web`. Sends from Resend's shared test domain
  (`onboarding@resend.dev`, new `RESEND_FROM_EMAIL` env var) — no DNS setup
  needed for this round, swap to a real Chomp domain once a real product
  email (item 7d or 7h) actually ships. **No product consumer built this
  session** — this was scoped and approved as infrastructure-only.
- **Manual verification completed, same session, after the user created a
  new "Sending access only" API key scoped to Chomp.** A throwaway local
  script (`node --env-file=.env.local`, never committed, deleted right
  after) confirmed a real send. Along the way, found that Resend's shared
  test domain will only deliver to the Resend *account's own* registered
  email, not an arbitrary `to` — so the first test send (to the user's
  actual email) got a 403 until retargeted at the account-owner address.
  This is now documented in `/docs/features/email.md` since it'll matter
  again whenever 7h gets built and tested. (Item 7d was scoped and built
  later this same session — see the entry below.)
- Tests: `packages/utils/src/truck-list-filters.test.ts` (+4,
  `filterTrucksByFavorite`), `apps/web/lib/trucks.test.ts` (+1, asserts the
  new `EXISTS` clause and that `viewerId` is interpolated into it), new
  `apps/web/lib/email.test.ts` (2, mocks the `resend` package the same way
  `storage.test.ts` mocks `@aws-sdk/client-s3`). Full suite (376 tests
  across `@chomp/utils` + `apps/web`), `tsc --noEmit`, and a real `next
  build` all verified clean — the `next build` check matters here
  specifically because `resend` is a server-only (Node) package, same class
  of risk as the `lib/storage.ts` bug documented in the 2026-08-03 session
  below.
- **Not done, no UI smoke test**: no live DB/Clerk session was available in
  this environment to manually click through the new toggle end-to-end (the
  plan's verification step 4). Automated tests + `next build` are the only
  verification this session got; worth a real click-through next session.

## This session (2026-08-16, favorite-activation notifications — item 7d)
- **Scoped and built roadmap item 7d**, the second consumer of the Resend
  plumbing wired up earlier this same session. Full scoping discussion
  (recipients, opt-in default, re-trigger rule, delivery mechanism) is in
  `/docs/features/favorite-notifications.md`; not repeated here.
- **Decisions locked in with the user**: direct truck-favoriters only (not
  menu-item favoriters); **opt-in only, off by default**, toggled on
  `/account` — push notifications are explicitly deferred to a future
  native-app phase, so this round is email-only; fires only on a real
  off→on activation transition (re-posting while already active, whether
  the same spot or a new one, never re-notifies — `extendLocation` was
  already a separate "still here" code path, untouched here); delivered
  async via a new Inngest event (`app/truck.activated`), not synchronously
  in the request path.
- **`postLocation` (`apps/web/lib/locations.ts`)** now checks, inside the
  same `$transaction` as the write (not before it — atomic with the write
  it's gating, same rigor `extendLocation`'s WHERE clause already applies),
  whether an active current location existed. On a true activation, fires
  `app/truck.activated` after the transaction commits. Return type
  unchanged (`Promise<void>`) — the Inngest send happens entirely inside
  `lib/locations.ts`, so the server action layer stays unaware of Inngest.
- **New Inngest function** `notifyFavoritesOnActivationFunction`
  (`apps/web/inngest/functions.ts`), same handler/function split as
  `eraseUserHandler`/`eraseUserFunction` for direct unit testability.
  Resolves recipients fresh from the DB at send time (not carried on the
  event), sends one email per recipient via `Promise.allSettled` (not
  `Promise.all` — one bounce shouldn't fail the whole run and trigger a
  full re-send to everyone), individually rather than cc/bcc so favoriters
  never see each other's addresses. Registered in
  `apps/web/app/api/inngest/route.ts` alongside the existing two functions.
- **New `apps/web/lib/favorite-notifications.ts`** — `getTruckNameAndSlug`,
  `getOptedInFavoriterEmails` (only truck favorites with
  `user.notifyFavoriteActive: true`), `activationEmailHtml`. Also extracted
  `appUrl()` out of `app/actions/invites.ts` (was a private local helper)
  into a new shared `apps/web/lib/site-url.ts`, since this feature needed
  the same absolute-URL-building logic invites already had.
- **New migration** `20260816225240_add_notify_favorite_active` —
  `users.notify_favorite_active BOOLEAN NOT NULL DEFAULT false`, no
  backfill. **Presented to the user and explicitly approved before
  running**, per this project's standing rule; applied cleanly to the Neon
  dev DB, `prisma migrate status` confirms no drift.
- **Account page**: new `updateNotificationPreferenceAction`
  (`apps/web/app/actions/account.ts`, no target-userId parameter — same
  IDOR-free pattern as `deleteOwnAccountAction`) and a new
  `NotificationPreferences` component, wired into `/account` between
  "Your favorites" and "Your reviews."
- Tests: `apps/web/lib/locations.test.ts` (+5, the activation-transition
  branch, including a check that the "was active" read happens against the
  transaction client so it can't race the write), new
  `apps/web/lib/favorite-notifications.test.ts` (6), `apps/web/inngest/
  functions.test.ts` (+5, the new handler/function pair), `apps/web/app/
  actions/account.test.ts` (+3, the new action). Full web suite (391
  tests), `tsc --noEmit`, and a real `next build` all verified clean both
  before and after the migration was applied — the pre-migration build
  correctly surfaced `The column users.notify_favorite_active does not
  exist`, confirming the code and the (not-yet-applied) schema change were
  consistent with each other before the DB was touched.
- **Not done, no UI smoke test**: same gap as the favorites-filter session
  above — no live DB/Clerk session available in this environment to click
  through the opt-in toggle or trigger a real activation email end-to-end.
  Worth a real click-through next session, including confirming the email
  actually arrives (same Resend shared-test-domain constraint documented in
  `/docs/features/email.md` applies here too).
- Of the original 7c/d/e/f/g/h smaller-gaps list, d and g are now done;
  c (content reporting), e (search by name/city/zip), f ("open now,"
  blocked on a missing per-truck timezone), and h (operator verification
  emails) remain unscoped. 7a (`TruckEvent`) from the broader gap-analysis
  is still the single biggest named, unbuilt gap.

## This session (2026-08-13, gap-analysis + get directions)
- **Re-ran the product gap-analysis** that originally produced location
  freshness (roadmap item 0) — the user asked what else was on that
  original list, and neither `HANDOFF.md` nor memory had it preserved
  (only the one item that got written into the roadmap survived). Rather
  than guess, re-did the analysis fresh against the current codebase:
  cross-referenced the original product scope (`HANDOFF.md`'s "What Was
  Decided This Session — Product" section) and existing schema against
  what's actually wired up. Findings written to `future-plans/roadmap.md`
  item 7 (a-h) at the user's request ("put all of these on the to-do
  list"): (a) `TruckEvent` — named in the original scope ("weekly schedule,
  menu, **events**"), fully modeled in the schema, own comment says
  "Planned feature — not yet wired to the UI," zero UI/API/docs; (b) no
  "Get Directions" link anywhere in the app (built this session, see
  below); (c) no customer-facing content-reporting/flagging, moderation is
  entirely admin-initiated; (d) favorites and location freshness aren't
  connected — no way to know a favorited truck just went "Active now"; (e-h)
  four already-self-flagged scope cuts re-surfaced as still open (search,
  "open now" indicator, favorites-only map/list filter, operator
  verification-decision notifications).
- **Built roadmap item 7b ("Get Directions" link)** from a plan scoped the
  same session (`future-plans/get-directions-plan.md`), after a Q&A round
  that included a real design detour: the user asked to understand the
  raw-DOM-vs-React distinction in `truck-map.tsx` first (why the map
  popup's favorite button can't use the same `revalidatePath`-driven
  no-local-state pattern as `TruckFavoriteButton`), then asked whether that
  pattern was "shoddy" and whether a `react-map-gl`/React-portal-based
  rewrite would be better — answered as an architecture recommendation
  (portals as a real lighter-weight middle ground; a full `react-map-gl`
  migration as a bigger, separate, higher-regression-risk refactor not
  worth bundling into this feature) without implementing either, then the
  user chose to proceed with the original scoping questions. Locked in:
  **truck detail page only** this pass (list/map popup surfaces
  deliberately deferred, not an oversight — the map popup would need the
  raw-DOM implementation just discussed); **shown regardless of location
  freshness** (a stale truck still gets the link, consistent with
  `LocationStatus` showing "last active" rather than hiding stale info);
  **address preferred, coordinates as fallback**.
- **New `packages/utils/src/directions.ts`**: `buildDirectionsUrl(address,
  lat, lng)` — a single Google Maps universal link
  (`.../maps/dir/?api=1&destination=...`), not separate Google/Apple links
  (opens the native app via deep-link handling on iOS/Android when
  installed, falls back to web otherwise, no platform detection needed).
  Returns `null` when there's no destination at all. Full test coverage
  including a special-characters-in-address encoding case.
- **A real coverage gap in `TruckDetail`, filled first per the plan**: no
  coordinates existed anywhere on the type — only the optional address
  text. `lib/trucks.ts#getTruckBySlug` gained a small second raw query
  (`ST_Y`/`ST_X` off `geom`, only run when a current location row exists)
  for `locationLat`/`locationLng`, same reason `getNearbyTrucks` already
  needs raw SQL for coordinates (PostGIS `geography` is `Unsupported()` in
  Prisma).
- **A real bug caught during real-DB verification, not left latent**: the
  first version cast the query's `truck_id` comparison as
  `${truck.id}::uuid`, mirroring `postLocation`'s existing `::uuid` cast in
  its `INSERT VALUES` — but that cast only works in an *assignment* context
  (inserting a uuid-typed value into a text column is allowed), not in a
  `WHERE col = value` *comparison*, which requires an exact type match on
  both sides of `=`. This schema has **no `@db.Uuid` on any id column**
  (confirmed via grep) — every id, including `truck_id`, is plain `TEXT` in
  Postgres, not a native `uuid` column. Casting the parameter to `uuid`
  produced `text = uuid`, which Postgres has no operator for — the page
  500'd. Caught by an actual Playwright run against the live dev DB (this
  environment has real Neon/Mapbox credentials, unlike most prior
  sessions), not by unit tests, since the mocked `$queryRaw` in
  `trucks.test.ts` doesn't validate real SQL. Fixed by dropping the cast
  (`truck_id = ${truck.id}`, plain text-to-text comparison, matching every
  other id comparison already in this codebase — `postLocation`'s cast was
  only ever safe because it's an INSERT, not a precedent to copy for a
  WHERE clause).
- **Verified end-to-end against the real dev DB**: a throwaway Playwright
  test (deleted after, never committed) confirmed the link renders and
  points at a real, correctly-encoded Google Maps URL for a seeded truck
  (`https://www.google.com/maps/dir/?api=1&destination=Somewhere%20near%20downtown%20Austin%20(Taco%20Kings)`).
- **Tests**: new `packages/utils/src/directions.test.ts` (4 tests); extended
  `apps/web/lib/trucks.test.ts` (`getTruckBySlug`'s existing tests gained
  `locationLat`/`locationLng` assertions, plus a new assertion that the
  coordinate query is never called when there's no current location row).
  Full `pnpm --filter web test`: 371/371 passing (no new test count change —
  extended existing cases rather than adding new ones, matching the plan's
  "extend" framing). Full `pnpm --filter web exec tsc --noEmit`: clean.
  Reverted the `tsconfig.json` mutation caused by the Playwright dev-server
  run, same as every prior session's `next build`/`next dev` mutation.
- **Not yet done / next session**: items 7a, 7c, 7d on the gap-analysis list
  (events, content reporting, favorites×freshness notifications) are
  flagged but not yet scoped — see `future-plans/roadmap.md` item 7 for
  what's already known about each. The list view and map popups still don't
  have a directions link (deliberately deferred this pass, see
  `docs/features/truck-detail.md`'s Get Directions section). None of this
  session's changes are committed to git yet — left as unstaged for review,
  same pattern as prior sessions.

## This session (2026-08-13, nearby list view)
- **Built roadmap item 0b ("Nearby-trucks list view + filter/sort")**
  straight from the plan scoped earlier the same session
  (`future-plans/nearby-list-view-plan.md`), after a Q&A round that locked
  in: a Map/List toggle on `/` (no new route); the list shows the **exact
  same filtered set** the map does (verified/active/unexpired location) —
  not a broader view, which meant "Active now first" sorting was considered
  and dropped, since every truck in this list is already active by
  construction; sort by Distance (default) or Rating; filter by cuisine
  (dropdown from values actually in use, not a fixed taxonomy) and minimum
  rating.
- **Real architecture fix, done first per the plan**: `TruckMap` used to own
  its geolocation-triggered refetch entirely internally (raw Mapbox refs,
  not React state) — a list view had no way to see that data. New
  `apps/web/components/truck-discovery.tsx` (client) now owns the truck
  array, the geolocation effect (moved out of `TruckMap`), and the
  Map/List toggle + filter/sort state. `TruckMap` became a controlled
  component (`trucks`/`center` props, three separate `useEffect`s: mount,
  re-render markers on `trucks` change, `flyTo` on `center` change) instead
  of calling `getNearbyTrucksAction` itself. `app/page.tsx` now renders
  `TruckDiscovery` instead of `TruckMap` directly.
- **`getNearbyTrucks` gained a rating aggregate**: a `LEFT JOIN` subquery
  over `reviews` (`AVG(rating)`/`COUNT(*)`, `WHERE is_visible = true` —
  same rule `getReviewSummary` already applies, just written in raw SQL),
  producing `averageRating`/`reviewCount` per truck. Needed for the rating
  sort/filter and to actually show a rating in list rows — not derivable
  client-side from data the query didn't already have.
- **New `packages/utils/src/truck-list-filters.ts`**: `sortTrucks`
  (distance ascending / rating descending, no-reviews trucks always sort
  last regardless of direction), `filterTrucksByCuisine` (OR-match across a
  multi-cuisine truck), `filterTrucksByMinRating` (excludes no-reviews
  trucks, inclusive boundary), `getDistinctCuisines` (dedup + sort, drives
  the cuisine dropdown from the already-fetched truck array, no separate
  query). Also added `formatDistanceMiles` to `packages/utils/src/index.ts`
  — no distance formatter existed anywhere in the codebase before this.
  Full test coverage for all of the above.
- **Filters apply to both views at once, sort only to the list**:
  `TruckDiscovery` runs `filterTrucksByCuisine`/`filterTrucksByMinRating` on
  the truck array before handing it to either `TruckMap` or `TruckList`, so
  toggling between Map and List never shows a different truck set — only
  `TruckList` additionally applies `sortTrucks`, since sort order has no map
  equivalent.
- **New `apps/web/components/truck-list.tsx`**: plain rows (distance,
  cuisine, rating or "No reviews yet", a favorite toggle, link to the
  truck's page). The favorite toggle (`ListFavoriteButton`) couldn't reuse
  `TruckFavoriteButton`'s no-local-state pattern — that pattern relies on a
  server-rendered prop refreshing via `revalidatePath`, but this list's
  truck data lives in `TruckDiscovery`'s client-held state (from the
  geolocation fetch), which nothing automatically re-fetches after a
  toggle. Uses local `useState` instead, same reasoning already applied to
  the map popup's favorite button, just via real React state since this
  isn't raw DOM.
- **New `apps/web/components/truck-list-controls.tsx`**: sort-by
  `<select>`, cuisine multi-select buttons, minimum-rating preset buttons
  (3.0+/4.0+/4.5+/Any) — visually matches `LocationDurationPicker`'s
  existing button-group pattern from the location-freshness session
  immediately before this one.
- **Verified against the real dev DB, not just mocked** — this environment
  had live Neon/Mapbox credentials available (unlike most prior sessions):
  re-ran the existing `apps/web/e2e/map.spec.ts` after the `TruckMap`
  refactor to confirm the geolocation-granted marker flow wasn't regressed
  (passed), then wrote and ran a throwaway Playwright test (deleted after,
  never committed) toggling to List and asserting real row content —
  confirmed distance/cuisine/rating all render correctly
  (`Taco Kings 0.0 mi · mexican · ★ 5.0 (1)`) and the toggle works both
  directions.
- **Tests**: new `packages/utils/src/truck-list-filters.test.ts` (14 tests)
  and an added `formatDistanceMiles` case in `index.test.ts`; extended
  `apps/web/lib/trucks.test.ts` (+2 — the rating-aggregate SQL shape and an
  updated row fixture). Full `pnpm --filter web test`: 371/371 passing. Full
  `pnpm --filter web exec tsc --noEmit`: clean. Real `pnpm --filter web
  build`: clean; reverted the incidental `tsconfig.json` mutation, same as
  every prior session. No new component-level unit tests for
  `TruckDiscovery`/`TruckList`/`TruckListControls` themselves — no test file
  existed for `TruckMap` either before this session, consistent with this
  repo's existing pattern of covering the pure/data layers with Vitest and
  the interactive layer with e2e (or, here, manual real-DB verification).
- **Not yet done / next session**: no dedicated list-view e2e test was
  added to the committed suite (the verification script above was
  throwaway) — worth adding if this page's interaction surface grows
  further. View/sort/filter selections aren't reflected in the URL, so
  there's no way to share a filtered link yet — flagged as a scope cut in
  `docs/features/map.md`, not an oversight. None of this session's changes
  (both the location-freshness work and this) are committed to git yet —
  left as unstaged for review, same pattern as prior sessions.

## This session (2026-08-13, location freshness)
- **Built roadmap item 0 ("Location freshness / 'Active now'")** straight
  from the fully-scoped plan written and approved the prior session
  (`future-plans/location-freshness-plan.md`) — no new product Q&A needed,
  the plan's locked-in decisions (hide expired trucks from "nearby" only,
  read-time computation with no background job, required duration on every
  post with presets 1h/2h/3h/4h/6h/All day, Extend while still active only,
  48h server-side cap) were followed as written. Built in the plan's own
  sequencing order (utils → types → write path & read path in parallel → UI
  → docs).
- **User also flagged a second idea this session** — a nearby-trucks list
  view sorted by distance, plus other filter/sort options (cuisine, rating,
  etc.) — assessed as safe to build later (mostly additive, reuses
  `getNearbyTrucks`'s existing PostGIS distance calc, no schema change
  anticipated) and deliberately **not built**, only flagged in
  `future-plans/roadmap.md` (new item 0b) per the user's explicit choice to
  jot it down and proceed with location freshness first.
- **No migration needed** — `TruckLocation.expiresAt` already existed
  (unused) since the very first migration; this session only started
  writing/reading it.
- **New `packages/utils/src/location-freshness.ts`**: `DURATION_PRESETS`
  (1h/2h/3h/4h/6h/allDay), `endOfLocalDay`/`expiresAtForPreset` (allDay
  resolves to end of local calendar day, computed client-side, not a
  no-expiry sentinel), `MAX_LOCATION_DURATION_HOURS = 48` +
  `isValidExpiresAt` (rejects unparseable/non-future/>48h-out — the real
  server-side abuse guard, called from both the post and extend write
  paths), `isLocationActive` (null `expiresAt` = always active; exclusive
  comparison, matching the read-time SQL's `expires_at > now()`). Full test
  coverage including the just-after-midnight `allDay` edge case.
- **Types** (`packages/types`): `PostLocationInput.expiresAt` (required ISO
  string); `TruckDetail.locationReportedAt`/`locationExpiresAt` — deliberately
  raw timestamps, not a precomputed boolean, so the UI's existing `timeAgo`
  need and the freshness check share one source of truth instead of two that
  could disagree.
- **Write path** (`apps/web/lib/locations.ts`): `postLocation` now validates
  and stores `expiresAt`; new `extendLocation(truckId, expiresAt)` — a single
  conditional `updateMany` (`WHERE isCurrent = true AND (expiresAt IS NULL OR
  expiresAt > now())`) is the actual enforcement that an expired location
  can't be revived by extension, not just a UI gate; throws when it matches
  zero rows. `extendLocationAction` mirrors `postLocationAction`'s
  auth-gate + `revalidatePath` shape.
- **Read path** (`apps/web/lib/trucks.ts`): `getNearbyTrucks`'s `JOIN
  truck_locations` gained `AND (tl.expires_at IS NULL OR tl.expires_at >
  now())`. `getTruckBySlug`'s `locations` include is deliberately
  **unchanged** (still just `isCurrent: true`) — the truck's own page must
  keep showing last-known info even when stale; only reads `reportedAt`/
  `expiresAt` off the existing row.
- **UI**: `components/location-status.tsx` (new, shared, no client
  directive needed) — one component used by both the customer-facing truck
  page and the operator's own dashboard form so they can't drift on what
  "active" looks like; renders nothing with no current location, a green
  "Active now — until {time}" badge if `isLocationActive`, else a muted
  "Last active {timeAgo}" line. `components/dashboard/location-duration-picker.tsx`
  (new) — reused for both the initial post and Extend.
  `components/dashboard/truck-location-form.tsx` rewritten: required
  duration selection before submit, new Extend section shown only when
  `currentLocation && isLocationActive(currentLocation.expiresAt)`.
  `app/trucks/[slug]/page.tsx`: address block's gate switched from
  `currentAddress` to `locationReportedAt` — bundled fix, called out
  explicitly rather than silently: a coords-only post with no address text
  previously showed nothing at all; now it correctly shows the freshness
  status even without an address line.
- **Tests**: new `packages/utils/src/location-freshness.test.ts` (17 tests);
  extended `apps/web/lib/locations.test.ts` (+7, including `extendLocation`'s
  three cases) and `apps/web/app/actions/locations.test.ts` (+2, mirroring
  `postLocationAction`'s existing shape); extended `apps/web/lib/trucks.test.ts`
  (+3 — the freshness SQL condition, `locationReportedAt`/`locationExpiresAt`
  mapping, and the no-current-row null case). Full `pnpm --filter web test`:
  370/370 passing. Full `pnpm --filter web exec tsc --noEmit`: clean. Real
  `pnpm --filter web build`: clean; reverted the incidental `tsconfig.json`
  mutation, same as every prior session.
- **E2e deliberately skipped**, per the plan: genuinely not practical
  without a clock-mocking harness this repo doesn't have, and no
  authenticated-operator e2e fixture exists yet either (same gap noted in
  the mobile-nav session). Unit tests carry the correctness burden.
- **Not yet done / next session**: no browser session was available in this
  environment, so a full manual click-through (post a short-duration
  location, confirm "Active now" on both the dashboard and public page,
  confirm map presence, use Extend, verify the hide-on-expiry path via a
  direct DB timestamp edit) is still owed — same standing gap noted for
  every other interactive flow in this project's history. No seed-data
  enhancement was added (plan's optional step 7, non-blocking) — a seeded
  truck with a realistic future `expires_at` and one already-expired would
  help local-dev demo fidelity of the hide-from-map behavior, worth doing
  whenever someone's poking at this locally. The nearby-trucks list
  view + filter/sort idea (roadmap item 0b) needs its own product Q&A before
  a real plan gets written — see that roadmap entry for what's already
  known. None of this session's changes are committed to git yet — left as
  unstaged for review, same pattern as prior sessions.

## This session (2026-08-12, mobile nav)
- **Closed roadmap item 6 ("App navigation — mobile-first")** — the last
  open item on the entire roadmap. Full plan approved via `EnterPlanMode`
  before any code was written, per `CLAUDE.md`; multiple `AskUserQuestion`
  rounds resolved: hamburger+drawer (not bottom tab bar) for mobile,
  horizontal row on desktop, full 4-issue bundle in one pass (not phased),
  role-filtered Dashboard/Admin links, shadcn/ui installed now, OS-driven
  dark mode kept (not shadcn's default `.dark`-class toggle), and real
  signed-in-session role-matrix e2e deferred (no Clerk test-user fixtures
  exist in this repo yet — unit-tested instead).
- **shadcn/ui installed** for the first time in this repo (`components.json`,
  `components/ui/{button,sheet}.tsx`, expanded `app/globals.css`). Used
  narrowly: `Sheet` (mobile drawer) + `Button` (hamburger trigger) only.
  **Dark mode required a hand-fix**: the CLI's default `.dark`-class
  scheme would have silently broken the app's existing automatic
  (`prefers-color-scheme`) dark mode, since nothing anywhere adds that
  class — reverted to Tailwind v4's built-in media-query-based `dark:`
  instead. See `/docs/features/navigation.md`'s shadcn section.
- **New pure logic in `@chomp/utils`** (`nav-links.ts`, `nav-history.ts`,
  `dashboard-tabs.ts`, each with full Vitest coverage) — deliberately placed
  in the shared package rather than `apps/web/lib/`, per the roadmap's own
  standing direction to keep nav-adjacent logic reusable for the future
  React Native client.
- **Fixed a real bug**: the old header showed "Dashboard" to every
  signed-in user, not just operators. `app/layout.tsx` is now `async` and
  resolves `getCurrentUser()` + `getOperatedTrucks()` server-side before
  rendering the nav — no client-side role fetch.
- **Smart back-nav** on `/trucks/[slug]` uses a `sessionStorage`-backed
  path stack, not `document.referrer` — discovered during planning that
  Feed's truck links are soft (`next/link`) navigations that never update
  the referrer, while the map popup's are hard (raw DOM `<a>`) navigations
  that do; a referrer check would have silently worked for one arrival path
  and not the other. Documented explicitly in `/docs/features/navigation.md`
  so a future pass doesn't "simplify" it back into that bug.
- **Dashboard breadcrumbs** now share `DASHBOARD_TABS` with the tab row in
  `dashboard/[truckId]/layout.tsx` (previously hardcoded, no shared source).
- **New tests**: `apps/web/e2e/nav.spec.ts` (5 tests) and
  `truck-back-nav.spec.ts` (3 tests, including a real Map-arrival case using
  the same Mapbox-marker pattern as `map.spec.ts`), plus 25 new Vitest unit
  tests in `packages/utils`. Full suite verified green (24/24 e2e).
  Mid-session, the suite looked flaky (`net::ERR_ABORTED`/timeout failures
  on unrelated tests, "Fast Refresh had to perform a full reload" in the
  webServer log) — root cause was **a stray `pnpm --filter web dev` process
  from earlier in the session that was never killed**, sharing/thrashing
  the same `apps/web/.next` webpack cache with Playwright's own managed dev
  server on a different port. Not a real bug; fixed by killing the stray
  process tree and clearing `.next`. Lesson: always confirm a manually
  started dev server is actually killed (check `ps aux`, not just the port)
  before trusting an e2e run's failures.
- **Two pre-existing test failures found while running the full suite,
  confirmed present on a clean `main` checkout (not caused by this
  session) — both fixed this session anyway since they were quick and the
  Clerk one unblocks future work**:
  - `e2e/auth.spec.ts`'s "renders the Clerk sign-in widget" — was missing a
    Playwright `globalSetup` calling `@clerk/testing`'s `clerkSetup()`.
    Fixed: added `apps/web/e2e/global-setup.ts` (guarded — no-ops if Clerk
    env vars aren't present, so it doesn't break the whole suite for
    someone running without Clerk secrets configured, consistent with this
    repo's per-file `test.skip(!canRun, ...)` convention) and wired it into
    `playwright.config.ts`'s new `globalSetup` field. This is the same
    underlying gap that was blocking real signed-in role-matrix e2e
    coverage (operator sees Dashboard, admin sees Admin) — now unblocked
    for whoever picks that up next, though the fixtures/tests themselves
    still don't exist yet.
  - `e2e/feed.spec.ts`'s "renders qualifying reviews, linked to their
    truck" — the seeded dev DB has two feed items (a review and a photo)
    both linking to "Taco Kings," so `getByRole('link', { name: 'Taco
    Kings' })` matched two elements (Playwright strict-mode violation).
    Fixed by targeting `a[href="/trucks/taco-kings"]` instead, same pattern
    already used in the new `truck-back-nav.spec.ts`.
- **Housekeeping**: added `test-results/`, `playwright-report/`,
  `blob-report/` to the root `.gitignore` (Playwright's default output
  dirs were untracked and ungitignored before this session).
- **Environment note for next session**: `apps/web/.env.local`'s
  `DATABASE_URL`/`DIRECT_URL` contain an unescaped `&` in the query string
  (e.g. `...&pgbouncer=true`) — running `source .env.local` directly in
  bash misparses the `&` as a background-job operator and silently fails to
  export the variable (or exports it inconsistently depending on shell
  timing). Load env vars with a quoted per-line loop instead: `while IFS=
  read -r line; do [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && export
  "$line"; done < .env.local`. This cost real time this session — worth
  fixing at the source (quote the values in `.env.local`) if it comes up
  again.
- **Not yet done**: real-browser role-matrix e2e (operator sees Dashboard,
  admin sees Admin) needs Clerk test-user sign-in fixtures — same gap noted
  for `auth.spec.ts` above. A "show only my favorites" map filter and
  in-app notifications remain deferred from earlier sessions (unrelated to
  nav).

## This session (2026-08-11, account erasure)
- **Closed roadmap item 4 ("Account deletion / erasure handling")** — the last
  remaining item on the original numbered Open Items list. See
  `/docs/features/account-erasure.md` for the full design writeup.
- **Product decisions locked in through extended discussion before any code
  was written** (per `CLAUDE.md`'s "ask questions first" rule, across several
  rounds): reviews/photos are **anonymized, not deleted** (content stays
  visible, "Deleted user" attribution — mirrors the existing orphaned-review
  pattern from truck deletion); the `User` row is **hard-deleted**, not
  soft-deleted-and-PII-scrubbed (rejected my own first recommendation on this
  one after the user pushed back asking for "the correct way, not the
  laziest" — a retained scrubbed row risks a future PII column being
  forgotten in the scrub path forever, an actually-deleted row can't leak a
  column that doesn't exist); a user who's the **sole owner of a truck is
  never auto-resolved** (no silently promoting a manager to owner — would
  violate the explicit-consent principle already established for voluntary
  ownership transfer), blocked and routed to a new **generic** admin
  moderation queue instead (the user's explicit choice over a narrow
  single-purpose table); plus four follow-up decisions from plan review: build
  the admin escape-hatch tools (`adminDeleteTruckAction`/
  `adminReassignTruckOwner`) the queue needs to actually be resolvable
  (without them a blocked entry would be a dead end — no one has a live
  session to invoke the normal transfer/delete flows once the owner is
  banned/erased); keep a minimal permanent, non-PII `ErasureRecord`
  (`sha256(email)` + trigger + timestamp) proving a specific request was
  honored; block admin-on-admin deletion (admin accounts aren't self-service
  anywhere else in this app); add a separate `dismissModerationEntry` path
  that restores an account (reactivate trucks, unban) instead of always
  completing the erasure.
- **Migration `20260811211442_account_erasure`**, applied to the Neon dev DB
  after showing the user the exact generated SQL and getting explicit
  approval (per `CLAUDE.md`'s migration rule): `reviews.user_id`/
  `review_photos.user_id`/`truck_invites.created_by_user_id` made nullable
  (`ON DELETE SET NULL`, mirrors the existing `truckId` orphaning pattern
  exactly); `truck_operators.user_id`/`photo_likes.user_id` → `ON DELETE
  CASCADE` (purely personal, same bucket as favorites' existing cascade);
  new `moderation_queue_entries`/`erasure_records` tables + 3 new enums. No
  backfill. **`trucks.owner_id` deliberately untouched** — still required,
  still `RESTRICT` — the actual DB-level backstop that a truck can never end
  up ownerless, everything else exists to give a good UX/queue *before*
  hitting that wall, not to replace it.
- **A real modeling catch during the migration diff, not assumed**: two
  existing nullable FKs (`Review.moderatedByUserId`,
  `TruckInvite.acceptedByUserId`) had no `onDelete` written in the schema at
  all. Assumed at first this meant they defaulted to `RESTRICT` like every
  *required* FK in this app — generating the migration off an explicit
  `onDelete: SetNull` annotation on both produced **zero DDL change**,
  revealing Prisma's actual implicit default for an *optional* relation is
  already `SetNull`. Comments corrected to state this accurately rather than
  leave the wrong claim in the schema.
- **New `apps/web/lib/user-erasure.ts`**: `findUserByClerkId`,
  `findSoleOwnedTrucks` (a truck has exactly one owner by schema design, so
  "sole owner" and "owner" are the same check — the "sole" framing is about
  what it implies, not a multiplicity check), `deactivateTrucks`/
  `reactivateTrucks` (same `isActive` field truck verification already
  uses), `eraseUserRow` (one `$transaction`: delete the `User` row + write
  the `ErasureRecord`; classifies `trigger` from durable DB state — a
  resolved `ModerationQueueEntry` for the subject — rather than tagging
  whichever caller's Inngest event happens to win a race, which would be
  genuinely racy since self-service/admin/webhook sends can all fire near-
  simultaneously; idempotent, swallows Prisma P2025 as a retried/duplicate
  event, not an error).
- **New `apps/web/lib/moderation-queue.ts`**: the generic queue's CRUD +
  audit-writing primitive, mirroring `lib/reviews.ts#setReviewVisibility`'s
  shape. `openErasureBlockedEntry` is idempotent (no duplicate open entry per
  subject+reason — a re-delivered webhook or resent event can't spam it).
  `resolveModerationEntry` re-verifies `findSoleOwnedTrucks` live, never
  trusts the entry's stored `blockingTruckIds` snapshot; on success attempts
  `deleteClerkUser` (swallows a 404 — already deleted directly) and *always*
  also sends the erasure event directly regardless of that outcome, since a
  webhook won't re-fire for an account Clerk already knows is gone.
  `dismissModerationEntry` is the full opposite path: reactivate + unban,
  never triggers erasure.
- **New `apps/web/lib/clerk-admin.ts`**: the only file in the app allowed to
  call `@clerk/nextjs/server`'s `clerkClient()` directly (`banClerkUser`/
  `unbanClerkUser`/`deleteClerkUser`) — first use of Clerk's Backend API
  anywhere in this codebase. Reuses the existing `CLERK_SECRET_KEY`, no new
  env var, but that key now grants destructive account operations it didn't
  functionally exercise before — flagged in `.env.example`.
- **`lib/review-photos.ts#removeAllPhotoLikesForUser`**: batch version of
  `unlikePhoto`'s per-row decrement, run explicitly before `db.user.delete()`
  — `PhotoLike.userId`'s new `Cascade` would remove the rows on its own, but
  silently without ever touching `ReviewPhoto.likesCount`, desyncing the
  denormalized counter.
- **`lib/reviews.ts`/`lib/feed.ts` updated for anonymized attribution**:
  `toReviewView` keys off `userId === null` (not `!user`) so an erased author
  is never confused with a live user who simply has no `displayName` set —
  renders "Deleted user"/no avatar either way, review stays fully visible.
  `getFeedPage`'s raw SQL had a real, previously-latent bug caught here: `JOIN
  users` was an **inner** join, which would have silently dropped a feed item
  the moment its author got erased — the opposite of this feature's whole
  "content stays visible" premise. Fixed to `LEFT JOIN` with a `CASE WHEN
  user_id IS NULL THEN 'Deleted user'` fallback.
- **`lib/invites.ts#adminReassignTruckOwner`**: the admin-only escape hatch a
  blocked/held truck actually needs to become resolvable — mirrors
  `acceptOwnershipTransfer`'s transaction exactly but skips the offer/accept
  dance, since the outgoing owner (banned or already erased) can't
  participate to consent. Still requires the target to already be an
  existing manager, same constraint as the normal flow.
- **First event-triggered Inngest function** in this codebase (the feed
  refresh is cron-only): `eraseUserFunction`/`eraseUserHandler`
  (`apps/web/inngest/functions.ts`), triggered on `app/user.deleted`, sent
  from `lib/clerk-webhook.ts`'s `user.deleted` case (previously a
  `console.warn` no-op stub) and from `resolveModerationEntry`. Registered in
  `app/api/inngest/route.ts`'s `functions` array.
- **New admin surfaces — this app's first-ever in-app admin
  user-management UI**: `/admin/users` (list + owner-only-aware delete, blocks
  admin targets) and `/admin/moderation` (per-entry blocking-truck actions —
  delete or reassign each one inline — plus Resolve/Dismiss), both under the
  existing `requireAdmin()`-gated `/admin` layout, nav links added. New
  `app/actions/admin-users.ts` (kept separate from `admin.ts` to stay
  focused): `deleteUserAction`, `resolveModerationEntryAction`,
  `dismissModerationEntryAction`, `adminDeleteTruckAction`,
  `adminReassignTruckOwnerAction`.
- **Self-serve**: `/account` gained a "Delete my account" danger-zone section
  (`components/account/delete-account-section.tsx`, mirrors
  `delete-truck-section.tsx`'s type-to-confirm pattern, confirming email
  instead of a truck name). `deleteOwnAccountAction`
  (`app/actions/account.ts`) never accepts a target `userId` — operates only
  on the caller's own session, eliminating the IDOR surface by construction.
  Clerk's embedded `<UserProfile />` also has its own built-in delete-account
  button with no per-component way to hide just that section — the user
  **turned off Clerk's instance-level "allow users to delete their account"
  toggle directly in the Clerk Dashboard this session** (User & authentication
  → User model → User permissions), confirmed live, so `DeleteAccountSection`
  is now the only in-app path. That toggle doesn't cover an admin deleting a
  user from the Clerk Dashboard's own Users page — a separate action — which
  is exactly why the erasure job's sole-ownership check holds/queues
  defensively regardless of which path triggered the webhook.
- **Tests**: new `lib/user-erasure.test.ts` (10), `lib/moderation-queue.test.ts`
  (13), `lib/clerk-admin.test.ts` (3), `app/actions/admin-users.test.ts` (14),
  `app/actions/account.test.ts` (5); extended `lib/review-photos.test.ts`,
  `lib/reviews.test.ts`, `lib/feed.test.ts`, `lib/clerk-webhook.test.ts`,
  `lib/invites.test.ts`, `inngest/functions.test.ts`. Full `pnpm --filter
  @chomp/web test`: 361/361 passing (up from 297). Full `pnpm type-check`
  across all packages: clean. Real `pnpm build`: clean (re-confirmed no
  client-bundle leak — the `node:crypto`/Clerk-backend-SDK class of bug that
  bit the truck-deletion session twice didn't recur here); reverted the
  incidental `tsconfig.json` mutation, same as every prior session.
- **Real-DB verification** (throwaway script, same pattern as prior
  cascade-verification sessions, deleted after use): Scenario A — a user with
  reviews/likes/a manager role/a sent invite but no owned truck, erased,
  confirmed `Review`/`ReviewPhoto` survive with `userId NULL` and
  `likesCount` still correct, `TruckOperator`/`PhotoLike` gone,
  `TruckInvite.createdByUserId` `NULL`, `User` row gone, `ErasureRecord`
  written (`trigger: 'direct'`). Scenario B — a sole truck owner, blocked
  (truck deactivated, `ModerationQueueEntry` opened idempotently — a
  duplicate call didn't create a second entry), resolved via
  `adminReassignTruckOwner` + a direct erasure re-run, completed with
  `trigger: 'resolvedFromModerationQueue'` correctly referencing the entry.
  Confirmed zero leftover rows afterward.
- **Not yet done / next session**: none of this session's changes are
  committed to git yet — left as unstaged for review, same pattern as prior
  sessions. Clerk's instance-level self-serve-deletion toggle is now off
  (confirmed live in the Clerk Dashboard, see above) — the one remaining gap
  is a full signed-in click-through of the self-serve delete flow and the
  admin block/resolve/dismiss UI (no Chrome browser session was
  available in this environment — same gap already flagged for every other
  Clerk-dependent interactive flow in this project's history). The real Clerk
  Backend API calls (`banClerkUser`/`unbanClerkUser`/`deleteClerkUser`) are
  covered by mocked unit tests only, never exercised against a real Clerk
  test account. With this session, every item on the original numbered Open
  Items list is done — mobile-first nav (roadmap item 6) is the only
  intentionally-open, unscoped item left on the whole roadmap.

## This session (2026-08-10, favorites)
- **Closed roadmap item 7, Phase 2 ("Account page — favorites")** — see
  `/docs/features/account.md#favorites` and `future-plans/roadmap.md` for
  the updated punch list. With this, the account page's full original
  vision (profile details, favorites, reviews) is built.
- **Product decisions locked in with the user before building** (per
  `CLAUDE.md`'s "ask questions first" rule): **private only** — no public
  favorite count anywhere, a personal save list, not a popularity signal
  (unlike photo likes' `likesCount`); **the map is in scope** — a favorite
  toggle on the map's truck popups, not just the truck detail page, despite
  popups being raw DOM rather than React; a signed-out visitor sees **no
  favorite button at all** (matches `PhotoLikeButton`'s pattern, not the
  review form's "sign in to..." prompt). Confirmed both trucks and
  individual menu items should be favoritable independently (saving a dish
  doesn't require favoriting the whole truck).
- **Migration `20260810223526_add_favorites`**, applied to the Neon dev DB
  after showing the user the exact generated SQL and getting explicit
  approval (per `CLAUDE.md`'s migration rule): two new tables,
  `truck_favorites` and `menu_item_favorites`, both composite-PK join
  tables like `PhotoLike`/`TruckOperator` — but **unlike `PhotoLike`, both
  FKs on both new tables cascade** (`truckId`/`menuItemId`, and `userId`).
  Deliberate deviation, documented in the schema comments: a favorite has
  zero preserve-for-record-keeping value once its truck/item is gone (unlike
  a review), same reasoning that justified `onDelete: Cascade` on
  `TruckOperator`/`TruckLocation`/etc. in the truck-deletion migration two
  sessions ago. The `user`-side cascade is inert today (`user.deleted` is
  still a no-op) but is the correct FK for whenever that gets built.
- **New `apps/web/lib/favorites.ts`**: `favoriteTruck`/`unfavoriteTruck`,
  `favoriteMenuItem`/`unfavoriteMenuItem` (scoped by `truckId` too, same
  IDOR-prevention idiom as `lib/menu.ts` — a `menuItemId` that doesn't
  belong to `truckId` is rejected before the upsert), `getFavoriteTrucksForUser`/
  `getFavoriteMenuItemsForUser`. Uses `upsert` with an empty `update: {}`
  for idempotent toggling — simpler than `likePhoto`'s create-and-catch-P2002
  pattern, since there's no denormalized counter to keep in sync (that's
  specifically why photo likes need a transaction; favorites don't touch a
  count at all, per the private-only answer).
- **Threaded `isFavorited` into existing reads**, same pattern
  `ReviewPhoto.isLikedByViewer` already uses: `lib/trucks.ts#getTruckBySlug`
  and `#getNearbyTrucks` both gained an optional `viewerId` param.
  `getNearbyTrucks`'s raw `$queryRaw` (PostGIS) got a
  `LEFT JOIN truck_favorites tf ON tf.truck_id = t.id AND tf.user_id =
  ${viewerId ?? null}` — an anonymous request's `null` never matches
  (standard SQL three-valued logic), so every truck's `isFavorited` comes
  back `false` rather than needing a separate code path. Two call sites
  updated to resolve `getCurrentUser()` and pass the id through:
  `app/page.tsx` (initial server render) and `getNearbyTrucksAction`
  (`app/actions/trucks.ts`, the client's geolocation re-fetch).
- **A real type-modeling snag, caught by `pnpm type-check`, not guessed
  around**: `MenuItemView`/`MenuCategoryView` turned out to be shared
  between two different consumers — the public truck page
  (`getTruckBySlug`) and the operator dashboard's own menu editor
  (`lib/menu.ts#getMenuForEdit`), which has no viewer/favoriting concept at
  all. Making `isFavorited` a required field broke the dashboard editor's
  existing tests/types. Fixed by making it optional
  (`isFavorited?: boolean`) rather than splitting the shared type — the
  dashboard editor simply never sets or reads it; only the public path does,
  always to a real boolean.
- **Matched an existing pattern instead of inventing a new one**: the first
  draft of `TruckFavoriteButton` used local optimistic `useState`. Caught
  during self-review that `PhotoLikeButton` (`components/truck-reviews.tsx`)
  has *no* local state at all — it relies entirely on `revalidatePath` +
  the server component re-rendering with a fresh prop after the action's
  round-trip. Rewrote `TruckFavoriteButton` and the new
  `MenuItemFavoriteButton` (inside `truck-menu.tsx`) to match that exact
  pattern instead, which meant `favoriteTruckAction`/etc. needed a `slug`
  param too (to `revalidatePath('/trucks/${slug}')`), same shape as
  `likePhotoAction(truckId, slug, photoId)`.
- **The map's popup favorite button is the one genuinely new UI pattern**:
  Mapbox popups (`components/truck-map.tsx`) are raw DOM
  (`document.createElement`), not React — there's no revalidate-and-re-render
  available. `buildFavoriteButton` owns and updates its own
  `textContent`/`aria-pressed` directly via a closured local variable after
  each toggle, calling `favoriteTruckAction`/`unfavoriteTruckAction`
  directly from a plain `addEventListener('click', ...)` (server actions
  are callable from any client JS, not just React `onClick` — no special
  plumbing needed). `TruckMap` gained a `viewerSignedIn` boolean prop,
  resolved once server-side in `app/page.tsx`, since there's no
  `<SignedIn>` React context available inside a popup to check against.
- **New UI**: `components/truck-favorite-button.tsx` (truck detail page,
  `<SignedIn>`-only, no count); a `MenuItemFavoriteButton` colocated inside
  `truck-menu.tsx` (same pattern, per item); `components/account/my-favorites.tsx`
  (two sections — Favorite trucks / Favorite menu items — **unlike the
  reviews section, these rows get an unfavorite button right here**, not
  confirm-gated, since removing a favorite isn't destructive the way
  removing a manager or deleting a truck is).
- **Verified the new 2-hop cascade for real, not just mocked**: a throwaway
  script (deleted after use, same pattern as prior credential/cascade
  verification sessions) created a fully-populated test truck against the
  real Neon dev DB — a favorited truck and a favorited menu item — deleted
  the truck, and confirmed both `TruckFavorite` and `MenuItemFavorite` rows
  disappeared (`Truck → MenuItem → MenuItemFavorite`, transitively, since
  `MenuItem → Truck` already cascades from the truck-deletion session).
  Cleaned up the script and test rows afterward.
- **Tests**: new `lib/favorites.test.ts` (9 tests) and
  `app/actions/favorites.test.ts` (8 tests); extended `lib/trucks.test.ts`
  for `getTruckBySlug`/`getNearbyTrucks`'s new `viewerId` param and
  `isFavorited` mapping (including the anonymous-viewer case) and
  `app/actions/trucks.test.ts` for `getNearbyTrucksAction`'s new
  `getCurrentUser()` call. Full `pnpm --filter @chomp/web test`: 297/297
  passing (up from 274). Full `pnpm type-check` across all packages: clean
  (after the `MenuItemView` fix above). Real `pnpm build`: clean —
  `/account/[[...rest]]` grew from 2.33kB to 3.55kB (the new favorites
  section); reverted the incidental `tsconfig.json` mutation, same as every
  prior session.
- **Docs updated**: `/docs/features/account.md` (new "Favorites" section,
  flipped the old "Scope cuts" entry), `/docs/features/map.md` and
  `/docs/features/truck-detail.md` (new notes on the favorite-button
  additions), `future-plans/roadmap.md` (Phase 2 marked done). Memory
  `project-account-favorites-deferred` retired now that its whole purpose
  (tracking this gap) no longer applies.
- **Not yet done / next session**: none of this session's changes are
  committed to git yet — left as unstaged for review, same pattern as prior
  sessions. Same manual-verification limit as the account-page session
  immediately before it: no browser extension was connected in this
  environment, so a full click-through of the map popup's heart button and
  the truck-detail-page/menu-item buttons wasn't possible — relied on the
  real `pnpm build` succeeding, the unit tests above, and the real-DB
  cascade script, flagged the same way rather than skipped silently. A full
  signed-in manual walkthrough of both this session's and the account-page
  session's work is still owed whenever a real browser session is
  available.

## This session (2026-08-10, account page)
- **Closed roadmap item 7, Phase 1 ("Account page — profile details +
  reviews")** — see `/docs/features/account.md` and
  `future-plans/roadmap.md` for the updated punch list.
- **Product decisions locked in with the user before building** (per
  `CLAUDE.md`'s "ask questions first" rule): phase it — profile + reviews
  now, favorites (trucks + individual menu items, both confirmed wanted)
  deferred to its own follow-up round; profile-detail editing embeds Clerk's
  own `<UserProfile />` inline rather than custom forms or linking out; the
  reviews section is read-only, linking back to each truck's own page to
  edit, rather than duplicating edit/delete UI here.
- **No migration needed** — the entire feature reuses the existing `Review`/
  `ReviewPhoto` tables (including the `truckId`-nullable orphaning from the
  truck-deletion session immediately prior) and Clerk's existing
  `user.updated` webhook sync. Zero new tables.
- **New catch-all route** `apps/web/app/account/[[...rest]]/page.tsx` — not
  a stylistic choice: Clerk's `<UserProfile />` pushes sub-paths for its own
  internal tabs (account/security/etc.), which need a matching catch-all to
  resolve, same reason `/sign-in`/`/sign-up` are already catch-alls. Not
  added to `middleware.ts`'s public allowlist — protected by default, same
  as `/dashboard`.
- **New `lib/reviews.ts#getReviewsForUser`**: every review by a user across
  all trucks, newest first, deliberately **including** orphaned ones
  (`truck: null` → `truckSlug`/`truckName: null`) — the entire point of the
  feature, and the opposite of `getAllReviewsForAdmin`'s deliberate
  exclusion of the same rows. No `isVisible` filter, same reasoning as the
  existing `getOwnReview`: a user must always see their own review even if a
  moderator hid it — the returned view carries `isVisible` so the UI can
  show a "Hidden by moderator" note instead of silently omitting it.
- **New type `MyReviewView`** (`packages/types`) — deliberately not
  `ReviewView` (`truckId: string` is non-nullable by design there, for
  truck-scoped views only) or `AdminReviewView` (excludes orphaned rows on
  purpose — the opposite of what this page wants).
- **New `components/account/my-reviews.tsx`** — plain server-rendered list
  (no client interactivity needed for a read-only view): rating, body,
  created date, photo thumbnail if present (same `next/image` + `unoptimized`
  convention as `truck-reviews.tsx`), a "Hidden by moderator" badge when
  `!isVisible`, and either a link to the truck's page or, for an orphaned
  review, a plain "{truckName} (deleted)" label with no link.
- **New header link**: `app/layout.tsx`'s `<SignedIn>` block gets a plain
  `<Link href="/account">Account</Link>` next to the existing "Dashboard"
  link — deliberately not a nav-bar overhaul; that's still its own,
  separately-scoped roadmap item (item 6 in the original numbered list, "App
  navigation — mobile-first").
- **Manual verification hit its limit, documented rather than skipped
  silently**: no Chrome extension was connected in this environment, so a
  full signed-in walkthrough (write a review, visit `/account`, delete the
  truck, confirm the review shows as orphaned) wasn't possible — same
  prerequisite gap already noted for every other Clerk-dependent interactive
  flow in this project. Did what was actually verifiable: a real `pnpm
  build` (route compiles, `/account/[[...rest]]` lists as its own route),
  and a `curl` check against the real dev server confirming `middleware.ts`
  actually gates the route (`x-clerk-auth-status: signed-out`,
  `x-clerk-auth-reason: protect-rewrite` on an unauthenticated request —
  Clerk's dev-instance handshake 404s under plain `curl` since there's no JS
  to complete it, but the header confirms the middleware intercepted the
  request rather than serving the page).
- **Tests**: new `lib/reviews.test.ts` coverage for `getReviewsForUser`
  (query shape, a normal review with a photo, an orphaned review with null
  truck fields, an `isVisible: false` review surfaced rather than filtered).
  Full `pnpm --filter @chomp/web test`: 274/274 passing (up from 270). Full
  `pnpm type-check` across all packages: clean. Real `pnpm build`: clean;
  reverted the incidental `tsconfig.json` mutation, same as every prior
  session.
- **Docs updated**: new `/docs/features/account.md`, `/docs/README.md`
  (new table row), `/docs/features/operator-dashboard.md` (updated the
  truck-deletion section's "no my reviews page" note now that one exists),
  `future-plans/roadmap.md` (new item 7, Phase 1 done / Phase 2 open).
  Memory `project-my-reviews-page-deferred` retired and replaced with
  `project-account-favorites-deferred`, refocused on what's actually still
  deferred (favorites) now that the page itself is built.
- **Not yet done / next session**: none of this session's changes are
  committed to git yet — left as unstaged for review, same pattern as prior
  sessions. Favorites (Phase 2) is next if picked up — see memory
  `project-account-favorites-deferred` for the scoping notes already
  captured (two favoritable entity types, UI touchpoints beyond just
  `/account`). A full signed-in manual walkthrough of this session's work
  is still owed whenever a real browser session is available.

## This session (2026-08-10, truck deletion)
- **Closed roadmap item 6 ("Truck deletion")** — see
  `/docs/features/operator-dashboard.md#truck-deletion` and
  `future-plans/roadmap.md` for the updated punch list. This closes out the
  entire "operational completeness" list.
- **Product decisions locked in with the user before building** (per
  `CLAUDE.md`'s "ask questions first" rule, across two rounds — the user
  interrupted the first round to ask a genuinely open design question before
  answering): reviews/photos are **orphaned** (`truckId` set `NULL`, DB-only
  retention, invisible everywhere in the product) rather than deleted —
  resolved this way specifically because a "my reviews" page that would
  actually surface them doesn't exist yet and was deliberately deferred
  (saved to memory `project-my-reviews-page-deferred` so a future session
  builds it with orphaned reviews in mind from the start, not as an
  afterthought); owner-only (no admin hard-delete power this pass); type-the-
  truck's-exact-name-to-confirm (the strongest confirmation gate in the app,
  stronger than the click-through Confirm/Cancel used everywhere else in the
  dashboard).
- **Migration `20260810210840_truck_deletion_cascades`**, applied to the
  Neon dev DB after showing the user the exact generated SQL and getting
  explicit approval (per `CLAUDE.md`'s migration rule): `onDelete: Cascade`
  added to `TruckOperator`/`TruckLocation`/`TruckSchedule`/`MenuCategory`/
  `MenuItem`/`TruckEvent`'s FKs to `Truck` (extending the one cascade
  precedent that already existed, `TruckInvite → Truck`); `Review.truckId`/
  `ReviewPhoto.truckId` made nullable with `onDelete: SetNull`. No backfill —
  `DROP NOT NULL` only relaxes the constraint going forward.
- **New `lib/trucks.ts#deleteTruck`**: validates the typed name matches
  (throws before touching the DB otherwise), gathers every Cloudflare Images
  asset URL still attached to the truck (logo, cover, every menu item's
  photo, every review's photo) *before* calling a single `db.truck.delete()`
  — the DB cascade/SetNull handles every related row declaratively, no
  hand-written multi-step delete needed — then best-effort cleans up each
  gathered Cloudflare asset afterward, reusing `extractCloudflareImageId`/
  `deleteCloudflareImage` from `lib/storage.ts` exactly as
  `lib/review-photos.ts` already does.
- **Verified the cascade for real, not just mocked**: wrote a throwaway
  script (deleted after use, same pattern as prior credential-verification
  sessions) that created a fully-populated test truck against the real Neon
  dev DB — a manager, a location, a schedule entry, a menu category with an
  item, an event, an invite, and a review with a photo and a like — deleted
  it via `deleteTruck`, and asserted all 11 expected outcomes directly
  against the DB: every operational table's rows gone, `Review`/
  `ReviewPhoto` survived with `truck_id = NULL`, `PhotoLike` untouched. This
  specifically exercised the one real risk flagged during planning — whether
  `MenuItem` (no direct cascade from `MenuCategory`) would still get cleaned
  up correctly via its own direct `truckId → Truck` cascade — confirmed yes,
  Postgres resolves multi-path cascades within one statement. Cleaned up the
  script and the review/photo/like/user rows it created afterward.
- **`lib/reviews.ts#getAllReviewsForAdmin` fix**: now filters
  `where: { truckId: { not: null } }` — an orphaned review has no truck left
  to moderate against, so excluding it from `/admin/reviews` is correct
  behavior, not a workaround. Its row-mapping also switched from an
  unconditional `row.truck.slug`/`row.truck.name` (which would throw on an
  orphaned row's now-nullable `truck` relation) to a `flatMap` guard that
  both narrows the type and defends against the filter ever being loosened
  by mistake — deliberately not a non-null assertion (`!`), which doesn't
  appear anywhere else in this codebase's `lib/*.ts` files.
- **`toReviewView` (`lib/reviews.ts`) refactored** to accept `truckId` as a
  separate parameter rather than reading `row.truckId` — both call sites
  (`getVisibleReviewsForTruck`, `getOwnReview`) already know it from their
  own query's filter, and it's always a concrete truck-scoped call, never an
  orphaned row; this avoided widening `ReviewView.truckId`'s type or
  asserting non-null on every truck-scoped read just to accommodate the two
  admin-queue rows that can now be orphaned.
- **New `apps/web/lib/truck-validation.ts`** — the same client-bundle bug
  documented from the photo-upload session recurred here: `deleteTruck`'s
  Cloudflare cleanup pulls `lib/storage.ts`'s Node-only deps (`node:crypto`,
  the AWS SDK) into `lib/trucks.ts`'s import graph, which broke
  `next build` for the two client components (`create-truck-form.tsx`,
  `truck-profile-form.tsx`) that import pure name/description length
  constants from `lib/trucks.ts`. Fixed with the same pattern already
  established for `lib/review-validation.ts`: pure validation split into a
  zero-server-import module, `lib/trucks.ts` re-exports it for existing
  server-side callers, the two client components import from the new module
  directly instead.
- **New UI**: `components/dashboard/delete-truck-section.tsx` — a "Danger
  zone" section on `/dashboard/[truckId]`, owner-only (the page now
  re-resolves `role` via `requireOperator`, same pattern as `team/page.tsx`,
  since the layout doesn't thread it down). Delete button stays disabled
  until the typed name exactly matches; on success, client-side
  `router.push('/dashboard')` (same `redirect()`-throws-through-`try/catch`
  reasoning already documented on `createTruckAction`).
- **New `deleteTruckAction`** (`app/actions/trucks.ts`) — a local
  `requireOwner` helper, same tiny duplicated-per-file pattern already used
  in `app/actions/invites.ts` rather than sharing across actions files.
- **Confirmed, not assumed**: `getFeedPage`'s `JOIN trucks t ON t.id =
  fi.truck_id` is an inner join, so a deleted truck's feed rows silently stop
  appearing on the very next query — no synchronous feed refresh needed on
  delete.
- **Tests**: extended `lib/trucks.test.ts` (new `deleteTruck` coverage — name
  mismatch, unknown truck, happy path with full Cloudflare cleanup, no-images
  no-op, gather-before-delete ordering), `lib/reviews.test.ts` (updated the
  now-stale "no visibility filter" `getAllReviewsForAdmin` test, added an
  orphaned-row defensive-skip case), `app/actions/trucks.test.ts` (new
  `deleteTruckAction` coverage — non-operator, manager, owner success,
  error-propagation). Full `pnpm --filter @chomp/web test`: 270/270 passing
  (up from 259). Full `pnpm type-check` across all packages: clean (caught
  the `toReviewView` typing issue from `Review.truckId` going nullable,
  fixed by the parameter refactor above). Ran a real `pnpm build` — first
  attempt failed on the `node:crypto` client-bundle bug above, second
  attempt after the `truck-validation.ts` fix compiled clean;
  `/dashboard/[truckId]` grew from 2.9kB to 3.38kB (the new Danger Zone);
  reverted the incidental `tsconfig.json` mutation, same as every prior
  session.
- **Not yet done / next session**: none of this session's changes are
  committed to git yet — left as unstaged for review, same pattern as prior
  sessions. Nothing prioritized next — see Open Item 18 above for the two
  remaining known gaps, neither of which is a go-live blocker.

## This session (2026-08-10, ownership transfer)
- **Closed roadmap item 5 ("Truck ownership transfer")** — see
  `/docs/features/operator-dashboard.md#ownership-transfer` and
  `future-plans/roadmap.md` for the updated punch list. Truck **deletion**
  was deliberately split out as its own item (6) and left open — flagged
  from the start as the highest-risk half of the original bundled roadmap
  item, needing more product decision-making than fit in one session.
- **Scope was refined mid-planning**: the first plan (approved, then
  reconsidered before any code was written) was an instant one-sided
  transfer — owner picks an existing manager, done immediately, no
  acceptance step. The user pushed back on that in plan review: ownership
  carries real responsibility, so it should require the target's explicit
  consent, the same way the manager-invite flow already requires the
  invitee to accept rather than auto-enrolling them. Replanned as an
  **offer/accept** flow before any implementation started.
- **Migration `20260810203148_add_truck_pending_owner`**, applied to the
  Neon dev DB after showing the user the exact generated SQL and getting
  explicit approval (per `CLAUDE.md`'s migration rule): one nullable
  `trucks.pending_owner_id` column (FK → `users.id`, `ON DELETE SET NULL`),
  no backfill. Deliberately no expiry field, unlike `TruckInvite` — a
  pending transfer is only ever visible to the specific manager it names, on
  their own authenticated dashboard (no shareable link that could leak), and
  the owner can cancel any time.
- **New `apps/web/lib/invites.ts` functions** (alongside `listManagers`/
  `removeManager`, which already own "team composition" logic in this file):
  `getPendingOwner` (reuses the existing `TruckManagerView` shape — no new
  type needed), `initiateOwnershipTransfer` (rejects a target who isn't an
  existing manager on this exact truck), `cancelOwnershipTransfer`,
  `acceptOwnershipTransfer` (swaps `Truck.ownerId` and both `TruckOperator`
  roles inside one transaction, with `updateMany` row-count checks as a race
  guard — same belt-and-suspenders idiom used throughout this file),
  `declineOwnershipTransfer`. `accept`/`decline` are gated entirely by "does
  `pendingOwnerId` match the caller" rather than `requireOwner` — the
  accepting user is a manager, not the owner, so the usual owner-only guard
  doesn't apply (same reasoning as `claimInviteAction`'s different auth
  shape).
- **`removeManager` updated**: now wrapped in `db.$transaction` so it also
  clears `pendingOwnerId` when the manager being removed is the current
  pending-transfer target — otherwise removing that manager would leave a
  dangling, unacceptable offer on the truck. Its docstring's stale
  "(ownership transfer isn't built yet)" parenthetical was replaced with a
  pointer to the new flow.
- **New UI** (`components/dashboard/team-manager.tsx`): owner sees a "Make
  owner" button per manager row (hidden while a transfer is already pending,
  replaced by a "transfer pending — Cancel" banner); the offered manager
  sees an accept/decline banner at the top of their own view of the same
  `/dashboard/[truckId]/team` page. Same inline `useState`-confirm +
  `useTransition` pattern as `Remove`/`Cancel invite` elsewhere in this
  component — no new modal component.
- **Tests**: extended `lib/invites.test.ts` (40 tests total in that file now
  — new coverage for all four transfer functions plus `removeManager`'s
  pending-offer cleanup, including a simulated-race rollback case for
  `acceptOwnershipTransfer`) and `app/actions/invites.test.ts` (new coverage
  for all four new actions' auth guards). Full `pnpm --filter @chomp/web
  test`: 259/259 passing (up from 236). Full `pnpm type-check` across all
  packages: clean. Ran a real `pnpm build` per the standing project lesson
  that `tsc`/vitest miss client-bundle bugs — compiled clean,
  `/dashboard/[truckId]/team` still shows up as its own route; reverted the
  incidental `tsconfig.json` mutation `next build` causes, same as every
  prior session.
- **Docs updated**: `/docs/features/operator-dashboard.md` (new "Ownership
  transfer" section), `/docs/features/manager-invites.md` (fixed two stale
  "no ownership transfer" references), `/go-live-requirements/operator-
  dashboard.md` (split the old combined bullet — transfer done, deletion
  still open), `/docs/architecture/schema.md` (added `pending_owner_id`),
  `future-plans/roadmap.md` (marked transfer done, split deletion out as its
  own item 6 with the recap of locked-in decisions and the open FK tension).
- **Not yet done / next session**: the seed script only creates `owner`
  `TruckOperator` rows, no `manager` fixtures — manual end-to-end testing of
  the full offer → accept/decline/cancel flow (as two different signed-in
  users) wasn't done in this session; needs a manager added via the
  invite flow first (real Clerk credentials), same prerequisite gap noted
  for other interactive-flow testing throughout this project. None of this
  session's changes are committed to git yet — left as unstaged for review,
  same pattern as prior sessions. Next up per the roadmap: truck deletion
  (item 6) — needs a fresh planning round to resolve the `Review`/
  `ReviewPhoto` FK-nullability question before anything can be built.

## This session (2026-08-07, manager-invite flow)
- **Closed roadmap item 4 ("Manager-invite flow")** — see
  `/docs/features/manager-invites.md` and `future-plans/roadmap.md` for the
  updated punch list.
- **Product decisions locked in with the user before building** (per
  `CLAUDE.md`'s "ask questions first" rule): shareable link only, no Resend
  (deliberately kept unwired until it has its own natural trigger);
  email-gated (claimant's Clerk email must match the invited email); owner-only
  (managers can't invite peers); 7-day expiry; owner can cancel a pending
  invite and remove an existing manager (there was previously no removal path
  for `TruckOperator` rows at all, short of Prisma Studio).
- **Migration `20260807164758_add_truck_invites`**, applied to the Neon dev DB
  after showing the user the exact generated SQL and getting explicit
  approval (per `CLAUDE.md`'s migration rule): new `InviteStatus` enum
  (pending/accepted/cancelled/expired) and `truck_invites` table
  (`truck_id` cascades on delete, `created_by_user_id`/`accepted_by_user_id`
  don't — matches how `Truck.owner`/`TruckOperator.user` are already left
  un-cascaded).
- **New `apps/web/lib/invites.ts`**: `createInvite` (reuses a live pending
  invite for the same truck+email instead of duplicating; rejects an email
  already on the team), `claimInvite` (pre-checks — not found, wrong status,
  expired, email mismatch — run as plain reads/writes; only the actual grant,
  `TruckOperator` creation + marking the invite accepted + a `User.role`
  upgrade, is wrapped in `db.$transaction`), `cancelInvite`/`removeManager`
  (both scoped by id **and** `truckId` via `updateMany`/`deleteMany` +
  `count === 1`, the same IDOR-prevention idiom as `lib/menu.ts`/`lib/schedule.ts`),
  `getInvitePreview` (unauthenticated-safe read that withholds `invitedEmail`).
  `removeManager` has an explicit "owner can't remove themselves" guard plus a
  belt-and-suspenders `role: 'manager'` scope on the delete itself.
- **Caught during self-review before finishing**: the first draft of
  `claimInvite` didn't upgrade a claiming `customer`'s `User.role` to
  `operator` the way `lib/trucks.ts#createTruck` already does on truck
  creation — nothing currently *reads* `User.role` for dashboard gating (that's
  all `TruckOperator` rows via `requireOperator`), but leaving it stale would
  have been a real data-consistency gap against an established precedent.
  Fixed — `claimInvite` is now documented as the third legitimate writer of
  `User.role` (`docs/features/auth.md`), same never-downgrades-existing-
  operator/admin rule as `createTruck`.
- **New owner-only guard pattern** (`app/actions/invites.ts`) — the first
  place in the app that needed "must specifically be the owner, not just any
  operator": `requireOperator` then an explicit `role !== 'owner'` check.
- **New UI**: `/dashboard/[truckId]/team` (invite form, pending-invites list
  with copy-link/cancel, current-managers list with remove — inline
  `useState`-mode-flag + `useTransition` confirm pattern, matching
  `truck-queue.tsx`/`review-queue.tsx` rather than extracting a new shared
  component) and `/invite/[token]` (public landing page — signed-out visitors
  see a sign-up/sign-in prompt with the email withheld, signed-in visitors get
  an explicit "Accept invite" button, not an auto-fire, so a stale/forwarded
  link can't silently enroll someone).
- **First post-auth redirect wiring in the app**: `sign-in`/`sign-up` pages
  now read a `redirect_url` query param and pass it to Clerk's
  `fallbackRedirectUrl`. **Added `lib/redirect.ts#safeRedirectPath`** to
  sanitize it first — only same-origin relative paths are accepted, rejecting
  absolute and protocol-relative (`//evil.com`) URLs that would otherwise turn
  this into an open redirect. `middleware.ts`'s public-route allowlist gained
  `/invite(.*)` so the landing page renders before auth; the claim action
  itself still independently requires a session.
- **New `inviteLimiter`** (`lib/rate-limit.ts`, 10/hour per owner) — applied
  only to invite creation, same reasoning pattern as the other three limiters.
- **New `NEXT_PUBLIC_APP_URL` env var** (`.env.example`) — the invite-creation
  action builds the shareable link server-side from this trusted value
  (falls back to `http://localhost:3000` if unset), never from client input.
- **Tests**: new `lib/invites.test.ts` (26 tests), `app/actions/invites.test.ts`
  (11 tests), `lib/redirect.test.ts` (5 tests), `e2e/invite.spec.ts`. Full
  `pnpm --filter @chomp/web test`: 236/236 passing. Full `pnpm type-check`
  across all packages: clean (caught one real issue —
  `exactOptionalPropertyTypes` rejected passing an explicit `undefined` to
  Clerk's `fallbackRedirectUrl` prop; fixed by having `safeRedirectPath`
  return `null` instead, which the prop's type actually allows). Ran a real
  `pnpm build` per the standing lesson that `tsc`/vitest can't catch
  client-bundle bugs — compiled clean, `/dashboard/[truckId]/team` and
  `/invite/[token]` both show up as their own routes; reverted the incidental
  `tsconfig.json` mutation `next build` causes, same as every prior session.
- **Not yet done / next session**: none of this session's changes are
  committed to git yet — left as unstaged for review, same pattern as prior
  sessions. Only roadmap item 5 (truck deletion/ownership transfer) remains
  on the "Operational completeness" list — needs real product decisions on
  data retention and reviews/photos cascade behavior before it can even be
  planned.

## This session (2026-08-07, R2 lifecycle rule)
- **Closed roadmap item 3 ("R2 bucket lifecycle rule")** — see
  `/docs/features/photo-upload.md` and `future-plans/roadmap.md` for the
  updated punch list.
- **Couldn't be done via API**: the app's own `CLOUDFLARE_R2_*` credentials
  are deliberately scoped to object read/write only on `chomp-uploads` (from
  the 2026-08-04 least-privilege session) — confirmed with real API calls
  that both `PutBucketLifecycleConfiguration` and its `Get` equivalent return
  `403 AccessDenied` with those credentials. The general `CLOUDFLARE_API_TOKEN`
  can't help either — scoped to Images only, no R2 access at all. Lifecycle
  management needs a broader R2 "Admin" permission tier that no existing
  app credential has, by design.
- **Configured manually in the Cloudflare dashboard** instead: `chomp-uploads`
  now has an `expire-orphaned-uploads` rule — prefix `uploads/` (matches the
  only key pattern `lib/storage.ts` ever writes), delete after 1 day, enabled.
  Verified by having the user read the dashboard's Lifecycle Rules tab back
  (API verification wasn't possible for the same permission reason as above).
- **Found and removed an unrelated pre-existing rule**: "Get outta here",
  no prefix (bucket-wide), delete-after-1-day, enabled — neither Claude nor
  initially the user recognized it. Flagged as possibly-suspicious (an
  unexplained bucket-wide deletion rule with an unusual name) before the user
  confirmed they'd created it themselves under unrelated circumstances and
  deleted it. Worth knowing if it resurfaces: it was bucket-wide with no
  prefix filter, so it would have deleted anything placed outside `uploads/`
  too, though nothing in the app ever writes there.
- **No app code changed** — this was a pure infra/dashboard change. Docs
  updated: `/docs/features/photo-upload.md`, `/go-live-requirements/photo-upload.md`,
  `future-plans/roadmap.md`, `.env.example`.

## This session (2026-08-05, feed refresh scheduler)
- **Closed roadmap item 2 ("Feed refresh scheduler")** — see
  `/docs/features/feed.md`'s "Refresh" section and `future-plans/roadmap.md`
  for the updated punch list. First real use of Inngest in the app (was
  listed as "not yet wired up").
- **Chose Inngest over Vercel Cron**, at the user's explicit direction —
  matches `stack.md`'s long-term background-jobs decision, even though it
  meant standing up a whole new service for what's currently a single
  scheduled job (Vercel Cron would have been zero-new-infra, but only sends
  `GET` where the old route was `POST`-only, and Hobby-plan cron is capped at
  once/day anyway).
- **New**: `apps/web/inngest/client.ts` (the `Inngest` client, `id: 'chomp'`),
  `apps/web/inngest/functions.ts` (`refreshFeedHandler` — a plain async
  function calling `refreshFeedView()` via `step.run`, exported separately
  from `refreshFeedFunction` so it's unit-testable without Inngest's own test
  runtime; `refreshFeedFunction` — `cron: '0 0 * * *'`, daily UTC),
  `apps/web/app/api/inngest/route.ts` (thin `serve()` wrapper).
- **Removed** (per the user's explicit "Inngest-only" choice): the old
  `POST /api/cron/refresh-feed` route and its test, `CRON_SECRET` from
  `.env.example`. `/api/cron(.*)` dropped from `middleware.ts`'s public
  allowlist; `/api/inngest(.*)` added instead (Inngest verifies every request
  itself via its signing key, same self-authenticating pattern as the Clerk
  webhook route).
- **Real Inngest credentials**: the user provided a real production
  `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` mid-session (pasted directly
  in chat) — put straight into `apps/web/.env.local` only (confirmed
  gitignored before writing), never echoed back in full afterward, never
  written to `.env.example`. Since a real prod signing key makes the Inngest
  SDK default to `mode: "cloud"` (signature-verified) regardless of
  `NODE_ENV`, added `INNGEST_DEV=1` to `.env.local` to force local dev mode
  (skips signature verification, talks to the local Dev Server) as agreed
  with the user — unset that when actually deploying.
- **Verified for real, not just mocked**: ran `next dev` alongside
  `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`.
  Confirmed the function registered (`GET /api/inngest` → `200`,
  `mode: "dev"`, `function_count: 1`; Dev Server's GraphQL API listed
  `Refresh feed materialized view`), then manually invoked it through the Dev
  Server's GraphQL mutation and confirmed the app log showed the real
  `REFRESH MATERIALIZED VIEW CONCURRENTLY feed_items` query executing against
  the actual Neon dev DB. Both dev processes stopped cleanly afterward.
- **Tests**: new `apps/web/inngest/functions.test.ts` (`refreshFeedHandler`
  runs `refreshFeedView` inside a named step; `refreshFeedFunction` registers
  with the expected id and daily cron trigger via a mocked `inngest` client).
  Deleted the old cron route's test. Net test count unchanged (194/194
  passing — 3 removed, 3 added). Full `pnpm type-check` across all 4
  packages: clean. Ran a real `pnpm build` twice (once per feature this
  session) per the standing lesson that `tsc`/vitest can't catch
  client-bundle bugs — both times `next build`/`next dev` auto-mutated
  `apps/web/tsconfig.json` as a side effect (same behavior `next lint`
  has, already documented below); reverted with `git checkout` each time so
  it doesn't show up in the diff.
- **Docs updated**: `/docs/features/feed.md` (new Inngest-based "Refresh"
  section, local-dev instructions, updated Testing/Setup checklist; also
  fixed unrelated stale "photo half will be empty" scope-cut left over from
  before photo upload shipped 2026-08-04), `/go-live-requirements/feed.md`
  (marked done, noted prod activation still needs a deploy + Inngest Cloud
  sync), `/docs/architecture/stack.md` (Background Jobs row).
- **Not yet done / next session**: none of this session's changes are
  committed to git yet — left as unstaged for review. Production activation
  (Open Item 17 above) can't happen until the app is actually deployed to
  Vercel, which hasn't happened yet in any session so far. Next up per the
  roadmap: the R2 lifecycle rule (item 3).

## This session (2026-08-05, review moderation queue)
- **Closed roadmap item 1 ("Review moderation queue")** — see
  `/docs/features/reviews.md`'s "Moderation queue" section and
  `future-plans/roadmap.md` for the updated punch list.
- **Migration `20260805194319_add_review_moderation_audit`**, applied to the
  Neon dev DB after showing the user the exact generated SQL and getting
  explicit approval (per `CLAUDE.md`'s migration rule): adds three nullable
  columns to `reviews` — `moderation_note`, `moderated_by_user_id` (FK →
  `users.id`, `ON DELETE SET NULL`), `moderated_at`. No backfill needed (all
  existing reviews get nulls). `prisma migrate dev --create-only` generated
  the SQL so it could be reviewed before applying, same two-step pattern as
  prior migration sessions.
- **`setReviewVisibility` (`apps/web/lib/reviews.ts`) now requires a reason**
  in both directions (hide and unhide) — the user explicitly chose "require
  reason on both" over the truck-verification precedent of only requiring one
  on reject/hold. Throws before touching the DB if the reason is blank; on
  success stores the reason plus the acting admin's id and a fresh timestamp,
  overwriting whatever the previous moderation action left. New
  `getAllReviewsForAdmin()` returns every review across every truck (truck
  name/slug, reviewer, rating, body, visibility, moderation note/by/at) for
  the queue.
- **New admin surface**: `/admin/reviews`
  (`apps/web/app/admin/reviews/page.tsx` +
  `apps/web/components/admin/review-queue.tsx`), modeled directly on the
  existing `/admin/trucks` queue — All/Hidden/Visible filter chips, and the
  same inline reason-input UX (text field + Confirm/Cancel, Confirm disabled
  until non-empty) as the truck queue's reject/hold flow. New
  `hideReviewAction`/`unhideReviewAction` in `apps/web/app/actions/admin.ts`,
  `requireAdmin()`-gated, revalidating `/admin/reviews` and the truck's public
  page.
- **Consolidated moderation onto one surface, at the user's explicit
  direction**: removed the old one-click "Hide (admin)" button that lived
  inline on the truck detail page (`components/truck-reviews.tsx`) along with
  its `isAdmin` prop and the now-fully-unused `canModerateReviews` permission
  helper (deleted from `lib/reviews.ts` — `requireAdmin()` already covers the
  same check for the new actions). A bare inline button couldn't collect a
  required reason without adding a second modal component, so `/admin/reviews`
  is now the only place hide/unhide happens.
- **Admin nav bar** added to `apps/web/app/admin/layout.tsx` (Trucks /
  Reviews links) — plain `Link`s, no active-state highlighting, matching the
  existing style of the dashboard's `/dashboard/[truckId]` nav rather than
  introducing a new pattern.
- **Tests**: extended `lib/reviews.test.ts` (new `setReviewVisibility`
  signature's reason validation and audit-field writes, `getAllReviewsForAdmin`
  mapping, removed the now-deleted `canModerateReviews` test) and
  `app/actions/admin.test.ts` (auth + reason-passing for the two new
  actions, alongside the existing truck verification action tests); trimmed
  `app/actions/reviews.test.ts` for the removed `setReviewVisibilityAction`.
  Full `pnpm --filter @chomp/web test`: 194/194 passing. Full
  `pnpm type-check` across all 4 packages: clean. Also ran a real
  `pnpm build` (not just `tsc`/vitest) given the prior session's lesson about
  client-bundle bugs `tsc`/vitest can't catch — compiled clean, `/admin/reviews`
  shows up as its own route in the build output. **Note**: `next build`
  auto-reformatted/added a few keys to `apps/web/tsconfig.json` as a side
  effect (same "reconfigures your tsconfig" behavior `next lint` does,
  already documented below in "Testing infra") — reverted that unrelated
  change with `git checkout` before finishing, so it doesn't show up in the
  diff for this feature.
- **Docs updated**: `/docs/features/reviews.md` (new "Moderation queue"
  section, updated data-layer/security/testing notes),
  `/go-live-requirements/reviews.md` (marked done),
  `/docs/architecture/schema.md` (added the three new `reviews` columns),
  `future-plans/roadmap.md` (marked item 1 done, moved feed refresh scheduler
  to the top of what's next).
- **Not yet done / next session**: none of this session's changes are
  committed to git yet — left as unstaged for review, same pattern as prior
  sessions. Next up per the roadmap: feed refresh scheduler (item 2).

## This session (2026-08-04, truck verification)
- **Closed the "how do we prevent fake truck accounts" gap** — see
  `/docs/features/truck-verification.md` for full details.
- **Migration `20260804140000_add_truck_verification_status`**, applied to the
  Neon dev DB after showing the user the exact SQL and getting explicit
  approval (per `CLAUDE.md`'s migration rule): replaces the inert
  `trucks.is_verified` boolean (never actually gated anything or had an admin
  UI) with a 4-state `verification_status` enum (`pending`/`verified`/
  `rejected`/`onHold`) + a `verification_note` text column. Hand-wrote the SQL
  as three separate statements (add columns → backfill → drop old column)
  rather than trusting `prisma migrate diff`'s single combined
  `ALTER TABLE ... DROP COLUMN ... ADD COLUMN ...`, which would have dropped
  `is_verified` before the backfill `UPDATE` could read it — confirmed this
  by actually running the diff command and comparing. All 6 seeded trucks had
  `is_verified = true`, so all backfilled to `verified` (user explicitly said
  not to worry about preserving/re-seeding differently).
- **Visibility gating**: `getTruckBySlug` and `getNearbyTrucks`
  (`apps/web/lib/trucks.ts`) now both require `verificationStatus: 'verified'`
  alongside the existing `isActive` check — a `pending`/`rejected`/`onHold`
  truck 404s on its public page and never appears on the map. Dashboard
  (`getTruckForEdit`) stays unfiltered so an operator can see/fix their own
  non-verified truck.
- **New admin surface** (`role === 'admin'`) — first one in the app:
  `apps/web/lib/admin.ts#requireAdmin()`, `/admin/trucks` (queue listing every
  truck regardless of status), `apps/web/app/actions/admin.ts`
  (`verifyTruckAction`/`rejectTruckAction`/`holdTruckAction`). Reject and hold
  both require a non-empty reason, stored in `verificationNote` and shown to
  the operator; verify clears it. "On hold" (user's addition to the original
  plan) lets an admin pull a *previously verified* truck back off the map
  without it reading as a fresh pre-launch rejection.
- **Dashboard status pill** (`components/dashboard/truck-profile-form.tsx`)
  and a **"Verified" badge** on the public truck page (unconditional, since
  `getTruckBySlug` only ever returns verified trucks now).
- **Tests**: new `lib/admin.test.ts`, `app/actions/admin.test.ts`; extended
  `lib/trucks.test.ts` for the new visibility filters, `getTruckForEdit`'s new
  fields, and the three new mutator functions. Updated `packages/db/prisma/seed.ts`
  (`isVerified: true` → `verificationStatus: 'verified'`) and one existing
  test that referenced the old field name. Full `pnpm --filter @chomp/web test`:
  189/189 passing. Full `pnpm type-check` across all 4 packages: clean.
  Re-ran `pnpm db:seed` against the real Neon dev DB after the schema change
  to confirm it still works end-to-end — it does.
- **Not yet done / next session**: **no admin users exist in the dev DB** —
  confirmed via a direct query (`SELECT ... WHERE role = 'admin'` → 0 rows).
  `/admin/trucks` is built and gated correctly but nobody can currently reach
  it without manually flipping a user's `role` to `admin` (e.g. via Prisma
  Studio — there's no self-serve admin-promotion flow, deliberately, since
  that would be its own security question). Also: none of this session's
  changes are committed to git yet, left as unstaged for review, same as the
  rate-limiting and dev-tooling work earlier today.

## This session (2026-08-04, rate limiting)
- **Closed roadmap item 2 ("Rate limiting, once")** — see `future-plans/roadmap.md`
  and `/docs/features/rate-limiting.md` for full details.
- **Created an Upstash Redis database** (`chomp-dev`) — this is the first real use
  of Redis in the stack, ahead of its other documented uses (location/feed
  caching). Credentials (`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) are
  in `apps/web/.env.local` and `.env.example`; verified working with a real `PING`
  against the REST API (`200 PONG`).
- **New shared primitive** `apps/web/lib/rate-limit.ts` — `@upstash/ratelimit`
  sliding-window limiters (`reviewLimiter` 5/hour, `truckCreationLimiter` 3/day,
  `uploadSlotLimiter` 20/hour), a `checkRateLimit(limiter, userId)` helper that
  throws on limit-exceeded (matches the existing throw-on-reject pattern used by
  `requireOperator`), keyed by Clerk `userId` since all three call sites already
  require sign-in.
- **Wired into three server actions**, right after resolving the acting user from
  the Clerk session and before any DB/Cloudflare write: `submitReviewAction`
  (`apps/web/app/actions/reviews.ts`), `createTruckAction`
  (`apps/web/app/actions/trucks.ts`), `requestUploadSlotAction`
  (`apps/web/app/actions/uploads.ts`). `finalizeUploadAction` deliberately left
  unlimited — it can't be reached without a slot key from the (limited)
  request-slot step.
- **Tests**: new `lib/rate-limit.test.ts` (mocked Upstash client); added a
  rate-limit-exceeded case to each of the three actions' existing test files
  (`reviews.test.ts`, `trucks.test.ts`, `uploads.test.ts`), all mocking
  `@/lib/rate-limit` the same way sibling libs are already mocked in those files.
  Full `pnpm --filter @chomp/web test` run: 172/172 passing.
- **Verified against the real Upstash database**, not just mocks: a throwaway
  script (deleted after use, same pattern as prior credential-verification
  sessions) hit the real REST API with a 2-per-window limiter, confirmed the 3rd
  call was denied (`success: false`), then cleaned up its own test key.
- **Not yet done**: none of this is committed to git — left as unstaged changes
  for review. `pnpm-lock.yaml`/`packages/db/package.json` from the earlier dev-tooling
  work in this same session are also still uncommitted.

## This session (2026-08-04, dev tooling)
- **Closed roadmap item 1 ("Make local dev solid")** — see `future-plans/roadmap.md`:
  - `packages/db/package.json` now has `"postinstall": "prisma generate"`, so any
    `pnpm install` (fresh clone, or after pulling a migration) regenerates the client
    automatically. This is the actual fix for the "stale client missing
    `ReviewPhoto.isVisible`" bug from the seeding session earlier today — that bug
    can't be caught by a git-diff-style check because the generated client isn't
    committed (`node_modules` is gitignored, no custom Prisma `output` path).
  - Added `husky` as a root dev dependency (`pnpm exec husky init`) with a
    `.husky/pre-commit` hook that only runs when relevant files are staged, to stay
    fast on unrelated commits:
    - If `packages/db/prisma/schema.prisma` or a migration file is staged: runs
      `prisma validate` then `prisma generate` in `packages/db`.
    - If any `package.json` or `pnpm-lock.yaml` is staged: runs
      `pnpm install --frozen-lockfile`, which fails immediately (without mutating the
      lockfile) if `package.json` deps and `pnpm-lock.yaml` have drifted apart — this
      is the actual fix for the "tsx declared but missing from `node_modules`" bug
      from earlier today.
  - **Verified both checks actually block a bad commit**, not just that the script
    runs: staged a `package.json` with an extra dependency not in the lockfile → hook
    failed with `ERR_PNPM_OUTDATED_LOCKFILE`, commit blocked. Staged a syntactically
    broken `schema.prisma` → hook failed with Prisma's `P1012` validation error,
    commit blocked. Reverted both test changes, then confirmed a real, valid change
    (the `postinstall` addition itself) committed cleanly through the hook.
  - Documented the Clerk CLI webhook tunnel workflow in `/docs/features/auth.md`
    (setup checklist, step 3) — verified the actual current command via Clerk's docs
    rather than guessing: `clerk webhooks listen --forward-to
    http://localhost:3000/api/webhooks/clerk` (Clerk CLI 2.0's webhooks toolkit,
    no linked project/Platform API required, `--token` pins a stable URL across
    restarts). Not yet exercised end-to-end against a real local sign-up in this
    environment — next session should actually run it and confirm a `User` row syncs.

## This session (2026-08-04, DB seeding)
- **Seeded the Neon dev DB** (closes Open Item 6 from the prior session):
  - `pnpm install` was needed first — `tsx` was declared in
    `packages/db/package.json` but missing from `node_modules` (dependencies
    had drifted out of sync with the lockfile).
  - **Found the generated Prisma Client was stale**: it didn't know about
    `ReviewPhoto.isVisible` even though the migration adding that column
    (`20260803120000_add_review_photo_visibility`) was applied to the DB last
    session — applying a migration doesn't regenerate the client, that's a
    separate step (`pnpm db:generate`), and nothing had exercised that field
    on a `create` until the seed script tried to. Regenerated the client,
    which fixed it.
  - Ran `pnpm db:seed` from `packages/db` successfully: "Seeded 6 trucks and
    refreshed the feed." Spot-checked row counts directly against the DB
    afterward: 6 trucks, 4 reviews, 1 review photo, 3 rows in `feed_items`.
  - The map, truck detail pages (Taco Kings/Pho Real have full menus and
    reviews), and `/feed` (Alice's 5-star review + liked photo) should all
    now show real data end-to-end.
- **Narrowed Cloudflare R2/Images credentials to least privilege** (closes Open
  Item 5 from the prior session):
  - User created a fresh **Account**-type R2 API token in the dashboard,
    scoped to *"Apply to specific buckets only" → `chomp-uploads`*. Swapped
    the new Access Key ID/Secret into `CLOUDFLARE_R2_ACCESS_KEY_ID`/
    `CLOUDFLARE_R2_SECRET_ACCESS_KEY` in `apps/web/.env.local`.
  - Verified with hand-signed SigV4 requests (stdlib `hmac`/`hashlib`,
    throwaway script deleted after use, same approach as the prior session):
    `ListObjectsV2` against `chomp-uploads` → `200`; the same request against
    the account root (no bucket) → `403 AccessDenied`, confirming the new
    token really is bucket-scoped and can't see `hivemind-releases`/
    `hivemind-uploads` like the old one could.
  - **The old general `CLOUDFLARE_API_TOKEN` was found deleted, not edited**,
    while the user was in the dashboard trying to strip its R2 permission
    group — a first check of both R2 and Images calls with it returned `401`
    on *both* (not just R2), and the user confirmed it no longer appeared
    under **My Profile → API Tokens** at all. No data was affected; user
    created a replacement token scoped to **Account → Cloudflare Images →
    Edit** only (matches what `lib/storage.ts` actually calls: create via
    `POST /images/v1`, delete via `DELETE /images/v1/{id}`), no R2 permission.
    Verified directly against Cloudflare's REST API: `GET .../r2/buckets` →
    `403`, `GET .../images/v1` → `200`.
  - Confirmed the two old ambiguous "Chomp uploads" R2 token entries (the
    Account/User pair from **R2 → Manage R2 API Tokens** flagged in the prior
    session) were deleted by the user — the old Access Key ID
    (`f68a992a502e498d79fdbbc819d1f7b9`) now gets `401 Unauthorized` from R2's
    S3-compatible API, confirming revocation.
  - Net result: `CLOUDFLARE_R2_ACCESS_KEY_ID`/`SECRET` can only touch
    `chomp-uploads`; `CLOUDFLARE_API_TOKEN` can only touch Images. Neither can
    reach the unrelated `hivemind-*` buckets or each other's surface anymore.

## This session (2026-08-03)
- Pulled 9 commits from `origin/main` (Clerk auth, map, truck detail, feed,
  operator dashboard, photo upload, and their tests — all landed in a prior
  session and were just fast-forwarded in locally).
- **Applied both pending migrations** to the live Neon dev DB using
  `packages/db/.env` (real credentials, provided by the user this session):
  `20260731120000_add_feed_items_unique_index` and
  `20260803120000_add_review_photo_visibility`. Ran `prisma migrate deploy`,
  confirmed with `prisma migrate status` → "Database schema is up to date!",
  no drift, no failed/edited migrations. (One transient `P1001` on the very
  first attempt, almost certainly Neon compute waking from autosuspend —
  resolved on retry, confirmed network/TLS/psql all worked fine in between.)
- Removed `packages/db/.env.example` (commit `b90a070`) now that
  `packages/db/.env` holds real credentials — an example file isn't needed
  alongside a working one, and it wasn't gitignored so keeping it around
  risked drift.
- **Moved `.env.local` from the repo root to `apps/web/.env.local`.** Next.js
  only reads `.env*` files from its own project directory (wherever
  `next.config.ts` lives) — a root-level `.env.local` is silently ignored by
  `next dev`/`next build` run via `turbo dev` from `apps/web`. The file's
  contents (all keys from `.env.example`, mostly still blank) were otherwise
  unchanged. Confirmed it's still gitignored at the new path
  (`.gitignore:15`, the `.env.local` pattern matches at any depth).
  **Still need to fill in real values** for Clerk/Mapbox/Cloudflare in that
  file before the app will run (see Open Items 1, 2, 4 above).
- **Verified all real credentials the user filled into `apps/web/.env.local`**
  (Clerk, Mapbox, Cloudflare) actually work, by hitting the real provider APIs
  directly rather than just checking the values look plausible:
  - Mapbox: live Geocoding API request with `NEXT_PUBLIC_MAPBOX_TOKEN` → 200.
  - Clerk: `CLERK_SECRET_KEY` against `GET /v1/users` on Clerk's API → 200;
    `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` decodes to the same Clerk instance
    (`safe-cricket-47.clerk.accounts.dev`).
  - Cloudflare R2: `CLOUDFLARE_R2_ACCESS_KEY_ID`/`SECRET` signed a real
    SigV4 request (HEAD + ListObjectsV2) against `chomp-uploads` on the R2
    S3-compatible endpoint → 200 (bucket exists, empty). No `boto3`/AWS CLI
    available in this environment, so the SigV4 signing was done by hand in a
    throwaway Python script (stdlib `hmac`/`hashlib` only), deleted after use.
  - Cloudflare general API token (`CLOUDFLARE_API_TOKEN`): first check showed
    the token itself was "active" but had **zero account access** (empty
    result from `GET /accounts`) — user had created it without assigning any
    permission groups. User fixed this in the dashboard; re-verified after
    and it now successfully lists R2 buckets and queries the Images API.
  - **In the process of re-verifying, found the token has account-wide R2
    access** — `GET /accounts/{id}/r2/buckets` returns `chomp-uploads` plus
    two buckets from an apparently unrelated project (`hivemind-releases`,
    `hivemind-uploads`) on the same Cloudflare account. Logged as Open Item 5
    above — not fixed yet, needs the user to act in the Cloudflare dashboard
    (token permission edits are the kind of access-control change to leave to
    the account owner, not something to push via API on their behalf even
    where technically possible).

## Auth
- Clerk wired up: `apps/web/middleware.ts` (route protection), `ClerkProvider` in
  `apps/web/app/layout.tsx`, `/sign-in` and `/sign-up` pages using Clerk's prebuilt
  components, webhook handler at `apps/web/app/api/webhooks/clerk/route.ts` +
  `apps/web/lib/clerk-webhook.ts`, and `apps/web/lib/auth.ts#getCurrentUser()`.
- Public (no-login) routes: `/`, `/trucks/*`, `/feed/*`, `/api/cron/*`, auth pages,
  the webhook. Everything else requires a session.
- Full details, flow diagram-in-prose, and the role model are in
  `/docs/features/auth.md`.

## Map view (this session)
- Root page (`/`) is the truck discovery map. Two-stage fetch: RSC renders trucks
  around a default fallback region (`DEFAULT_LOCATION` in `apps/web/lib/geo.ts`,
  currently an Austin, TX placeholder) immediately, then the client `TruckMap`
  component (`apps/web/components/truck-map.tsx`, using `mapbox-gl` directly)
  requests browser geolocation and re-fetches/re-centers via the
  `getNearbyTrucksAction` server action if granted.
- Query logic in `apps/web/lib/trucks.ts#getNearbyTrucks` (PostGIS `$queryRaw`,
  radius clamped to 50 miles, coordinates validated).
- `/` builds as a fully dynamic route (`force-dynamic`) since truck data is
  live — verified this with a real `next build`.
- Full details and scope cuts are in `/docs/features/map.md`.

## Truck detail page — profile, schedule, menu (this session)
- `/trucks/[slug]` (`apps/web/app/trucks/[slug]/page.tsx`) shows name, cuisine,
  description, current address, schedule, and menu for one truck. 404s for unknown
  or inactive trucks. Fetched in one query via `apps/web/lib/trucks.ts#getTruckBySlug`.
- Schedule: `apps/web/lib/schedule.ts` (today's-schedule filtering — no computed
  "open now", schema has no per-truck timezone yet).
- Menu (`apps/web/components/truck-menu.tsx` + `apps/web/lib/menu.ts`): read-only,
  grouped by category, dietary-flag filter chips (AND logic — an item must match
  every selected flag). Unavailable items are excluded at the query level, never
  sent to the client. Images via `next/image` with `unoptimized` (no remote-host
  allowlisting yet — deliberate, see `/docs/features/truck-detail.md`). No operator
  CRUD for menu items yet — that's the first piece of an operator dashboard, not
  built this pass; editing happens via Prisma Studio or the seed script.
- Price formatting: `MenuItem.price` is whole-dollar `Decimal(8,2)`, not cents —
  use `formatUsd` (`packages/utils`), not `formatPrice` (which assumes cents and
  would silently be wrong here).
- Reviews (`apps/web/components/truck-reviews.tsx` + `apps/web/lib/reviews.ts` +
  `apps/web/app/actions/reviews.ts`): rating + optional text, one per user per
  truck (upsert on resubmit), edit/delete own review, average rating + count.
  Every write action re-derives the acting user from the Clerk session
  server-side — the client never sends a user id or role. A minimal admin
  "Hide" action exists (`role === 'admin'`, checked server-side) but it's
  one-way from this page — no unhide UI, no moderation queue yet. Reviews can
  now carry a photo (see Photo upload below) — no rate limiting on submission
  yet, tracked in `/go-live-requirements/reviews.md`.
- `packages/db/prisma/seed.ts` — manual-only seed script (`pnpm db:seed`), ~6 fake
  trucks around Austin, TX matching the map's default region; "Taco Kings" and
  "Pho Real" have full menus (including one unavailable item and mixed dietary
  flags) and reviews (including two hidden reviews on Taco Kings — one low-rated,
  one high-rated, to test the hide filter independently of the rating filter, plus
  a seeded photo with 2 likes on Alice's review) to exercise all of the above.
  Ends with a plain (non-`CONCURRENTLY`) feed refresh.
- Full details and scope cuts are in `/docs/features/truck-detail.md` (profile/
  schedule/menu) and `/docs/features/reviews.md` (reviews).

## Public feed (this session)
- `/feed` (`apps/web/app/feed/page.tsx`) reads the `feed_items` materialized view
  (already existed) via `apps/web/lib/feed.ts#getFeedPage`, joined to trucks/users
  for the link and attribution. Page-based pagination (`?page=N`), no client-side
  fetching.
- **New migration** `20260731120000_add_feed_items_unique_index` adds a unique
  index required for `REFRESH MATERIALIZED VIEW CONCURRENTLY` — written but **not
  applied to any database yet**, see Open Items above.
- `POST /api/cron/refresh-feed` runs the concurrent refresh, gated by `CRON_SECRET`
  (added to the middleware's public allowlist — it authenticates itself via the
  bearer token, not a Clerk session, same rationale as the webhook route). Nothing
  calls this automatically yet.
- The photo half of the feed used to always be empty (nothing could create a
  `ReviewPhoto` row) — now that photo upload exists, it has real data; the seed
  script's liked photo clears the `likes_count >= 2` threshold.
- Full details in `/docs/features/feed.md`; go-live gaps in `/go-live-requirements/feed.md`.

## Operator dashboard (this session)
- `/dashboard` (switcher / "create your truck" CTA), `/dashboard/new` (truck
  creation), `/dashboard/[truckId]/*` (profile, menu, schedule, location), gated
  by `apps/web/lib/operators.ts#requireOperator(truckId)` — called at both the
  layout (page-render gate) and independently inside every server action
  (actions are callable directly, so the layout check alone isn't enough).
- Creating a truck (`lib/trucks.ts#createTruck`) makes the caller its owner and
  upgrades `customer` → `operator` — the second legitimate writer of `User.role`
  alongside the Clerk webhook; amended `/docs/features/auth.md` to say so.
- Menu and schedule CRUD (`lib/menu.ts`, `lib/schedule.ts`) scope every
  mutation by `truckId`, not just the record's own id — closes a cross-truck
  IDOR gap (an operator of truck A editing truck B's menu item by guessing its
  id). Uses `updateMany`/`deleteMany` with a 0-rows-affected check instead of a
  plain unique `where`, since Prisma's typed update/delete only accept actual
  unique-constraint fields.
- Location updates (`lib/locations.ts#postLocation`) reuse the customer map's
  browser-geolocation approach rather than geocoding a typed address —
  coordinates are what make a truck findable on the customer map at all, so
  they're required, not optional.
- Full details, the manager-parity/no-invite-flow nuance, and scope cuts are in
  `/docs/features/operator-dashboard.md`; go-live gaps in
  `/go-live-requirements/operator-dashboard.md`.

## Photo upload (this session)
- Hybrid storage: Cloudflare R2 (transient upload intake, presigned POST) +
  Cloudflare Images (permanent store/resizing/CDN, via its account-level
  "create from URL" API — no Cloudflare zone/DNS change needed, unlike the
  cheaper "remote transformations" billing tier which does require one).
  `apps/web/lib/storage.ts` is the core primitive: request a presigned slot →
  client uploads directly to R2 → server verifies the object, generates a
  short-lived presigned GET, hands it to Cloudflare Images, deletes the R2
  copy either way.
- Powers three surfaces: review photos (`attachReviewPhotoAction`, one per
  review, with like/unlike), menu item photos, and truck logo/cover — the
  latter two just replaced their old paste-a-URL inputs with
  `components/image-upload-field.tsx`.
- `ReviewPhoto.isVisible` added (new migration, see below) — was explicitly
  deferred from the reviews pass to "whenever photo upload is built." The
  feed's materialized view was rebuilt in the same migration to filter photos
  by it too.
- Two authorization layers: the generic upload actions
  (`app/actions/uploads.ts`) only require *some* signed-in caller (prevents
  anonymous abuse of a billed Cloudflare resource); truck/review-level
  authorization happens where the result is actually persisted
  (`requireOperator`, or the caller's own review — never a client-supplied
  `reviewId`).
- **Known gap, not yet closed**: an upload that's requested but never
  finalized leaves an orphaned R2 object with no code path that cleans it up
  — needs an R2 bucket lifecycle rule (infra config, documented but not
  configured anywhere).
- Full details (including why the array form of `$transaction` was replaced
  with the callback form for `likePhoto` — a real testability lesson, not
  just style) in `/docs/features/photo-upload.md`; go-live gaps in
  `/go-live-requirements/photo-upload.md`.
- **Build-breaking bug caught only by `next build`, not type-check or
  vitest**: `lib/storage.ts` uses `node:crypto` and the AWS SDK (real Node
  APIs). `truck-reviews.tsx` (a client component) was importing validation
  constants directly from `lib/reviews.ts`, which transitively pulled all of
  that into the client bundle — webpack can't bundle Node builtins for the
  browser. Fixed by extracting pure validation into
  `apps/web/lib/review-validation.ts` (zero server-only imports) for the
  client to import instead. **Lesson for next time**: a client component may
  only import a plain (non-`'use server'`) module directly if that module's
  entire import graph is browser-safe — Next only gives `'use server'` files
  special treatment (compiling them into RPC stubs instead of inlining).
  Always run the real `next build` after adding a new server-only dependency
  (Node builtins, an SDK) to a `lib/*.ts` file that any client component
  might import, even indirectly — `tsc` and `vitest` won't catch this class
  of bug.

## Testing infra (this session + earlier)
- Vitest configs added for `apps/web` and `packages/utils`; Playwright config for
  `apps/web`. 166 unit tests total (webhook handler, geo validation, schedule
  filtering, truck/menu/schedule/location CRUD, operator authorization
  (including the cross-truck IDOR case), reviews queries + actions, feed
  pagination + refresh, photo upload/storage/likes, shared utils).
- `apps/web/e2e/auth.spec.ts`, `map.spec.ts`, `truck-detail.spec.ts`,
  `feed.spec.ts`, and `dashboard.spec.ts` each have specs that only run once
  real Clerk/Mapbox/DB env vars and seed data are present — see the "Testing"
  section of the corresponding `/docs/features/*.md`. Actually creating a truck,
  submitting a review, or uploading a photo as a signed-in user isn't
  e2e-tested yet — needs real Clerk test credentials (`@clerk/testing`) and/or
  real Cloudflare credentials, same prerequisite gap as other Clerk-dependent
  flows.
- `next lint` is not usable as-is — this repo has no ESLint config yet, and running
  it interactively prompts to generate one (and will silently reformat/mutate
  `tsconfig.json` if you let it). Left alone; worth setting up deliberately later
  rather than accepting the auto-generated config.
- `packages/db` had no `type-check` script or `@types/node` and had never actually
  been type-checked — fixed while adding the seed script (which surfaced it).
- `packages/utils` had no test setup at all before this session — added
  (`vitest.config.ts`, `test`/`type-check` scripts).

---

## Migrations
| Migration | What it does | Applied to Neon dev DB? |
|---|---|---|
| `20260506222654_init` | Enables PostGIS, creates all tables, enums, indexes, and foreign keys | Yes (as of an earlier session) |
| `20260506222917_add_gist_index` | Partial GiST index on `truck_locations.geom WHERE is_current = true` | Yes |
| `20260506223040_add_feed_view` | `feed_items` materialized view + index for the public feed | Yes |
| `20260731120000_add_feed_items_unique_index` | Unique index on `feed_items.item_id`, required for `REFRESH MATERIALIZED VIEW CONCURRENTLY` | Yes (applied 2026-08-03) |
| `20260803120000_add_review_photo_visibility` | Adds `review_photos.is_visible`; rebuilds `feed_items` to filter the photo side by it too | Yes (applied 2026-08-03) |
| `20260804140000_add_truck_verification_status` | Replaces `trucks.is_verified` (boolean) with `verification_status` (enum: pending/verified/rejected/onHold) + `verification_note`; backfills `is_verified = true` → `verified` | Yes (applied 2026-08-04) |
| `20260805194319_add_review_moderation_audit` | Adds `reviews.moderation_note`, `moderated_by_user_id` (FK → `users.id`), `moderated_at` — no backfill | Yes (applied 2026-08-05) |
| `20260807164758_add_truck_invites` | New `InviteStatus` enum + `truck_invites` table (token, status, expiry, creator/acceptor FKs) — no backfill | Yes (applied 2026-08-07) |
| `20260810203148_add_truck_pending_owner` | Adds `trucks.pending_owner_id` (FK → `users.id`, `ON DELETE SET NULL`) — no backfill | Yes (applied 2026-08-10) |
| `20260810210840_truck_deletion_cascades` | `onDelete: Cascade` on `TruckOperator`/`TruckLocation`/`TruckSchedule`/`MenuCategory`/`MenuItem`/`TruckEvent`'s FKs to `Truck`; `reviews.truck_id`/`review_photos.truck_id` made nullable with `ON DELETE SET NULL` — no backfill | Yes (applied 2026-08-10) |
| `20260810223526_add_favorites` | New `truck_favorites`/`menu_item_favorites` tables (composite PK, both FKs `ON DELETE CASCADE`) — no backfill | Yes (applied 2026-08-10) |
| `20260811211442_account_erasure` | `reviews.user_id`/`review_photos.user_id`/`truck_invites.created_by_user_id` made nullable (`ON DELETE SET NULL`); `truck_operators.user_id`/`photo_likes.user_id` → `ON DELETE CASCADE`; new `moderation_queue_entries`/`erasure_records` tables + 3 new enums — no backfill | Yes (applied 2026-08-11) |

---

## Key Files to Review
- `/docs/README.md` — documentation table of contents
- `/docs/architecture/stack.md` — all tech decisions
- `/docs/architecture/schema.md` — full DB schema with design notes
- `/packages/db/prisma/schema.prisma` — Prisma schema (source of truth for DB)
- `/packages/db/prisma/migrations/` — all applied migration SQL files
- `/packages/db/src/index.ts` — Prisma client singleton
- `/.env.example` — all required environment variables
- `/CLAUDE.md` — rules Claude must follow on this project

---

## Notes
- `apps/web/.env.local` (app runtime) and `packages/db/.env` (Prisma CLI) are
  both gitignored — never committed. Each developer creates their own from
  `.env.example`. `apps/web/.env.local` is the one that matters for
  `next dev`/`next build` — a copy at the repo root is silently ignored.
- The Prisma client is generated into `node_modules` — run `pnpm db:generate` after any schema changes.
- PostGIS `geography(Point, 4326)` columns use `Unsupported()` in Prisma — all geospatial queries (`ST_DWithin`, `ST_Distance`) must use `prisma.$queryRaw`.
- The `feed_items` materialized view is refreshed daily by `apps/web/inngest/functions.ts#refreshFeedFunction` (Inngest cron trigger) — production activation still needs an Inngest Cloud app + sync once deployed, see Open Item 17. Never compute the feed inline from the base tables.
- `CREATE EXTENSION IF NOT EXISTS postgis;` is included at the top of the `init` migration — any fresh DB will get PostGIS automatically.
- Node 24.15.0 is required. Managed via asdf (`.tool-versions` in home dir) and nvm (`.nvmrc` in project root).
- When running `prisma migrate` from Claude Code, Prisma requires explicit user consent via `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var for destructive operations (`reset`, `drop`).
