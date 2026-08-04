# Chomp — Session Handoff

> This file is updated at the end of every Claude session.
> It contains everything needed to resume work immediately.

---

## Last Updated
2026-08-04

## Current Phase
**Clerk auth, map view, truck detail page (profile + schedule + menu + reviews + photos), the public feed, the operator dashboard, and photo upload (R2 + Cloudflare Images hybrid) wired up — all code-complete. Both pending migrations are now applied to the Neon dev DB. Real Clerk, Mapbox, and Cloudflare (R2 + Images) credentials are in `apps/web/.env.local` and verified working end-to-end. Cloudflare credentials are least-privilege: a dedicated R2 token scoped to only the `chomp-uploads` bucket, and a separate Images-only general API token. The Neon dev DB is now seeded (6 trucks, reviews, a liked photo, refreshed feed) — see "This session" below. The app is ready to run/deploy against real data.**

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
- **Background Jobs**: Inngest (not yet wired up)
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
7. **Set `CRON_SECRET`** and point a scheduler at `POST /api/cron/refresh-feed`
   once deployed — nothing calls it automatically yet (see `/go-live-requirements/feed.md`).
8. **Account deletion / erasure handling** — `user.deleted` webhooks are currently a
   no-op (see `/docs/features/auth.md` and `/go-live-requirements/auth.md`). Needs a
   real decision before launch.
9. **Review submission rate limiting + a real moderation queue** — both deliberately
   deferred, see `/go-live-requirements/reviews.md`.
10. **Operator dashboard go-live gaps** — no truck-creation rate limiting, no
    manager-invite flow, no way to delete a truck/transfer ownership — see
    `/go-live-requirements/operator-dashboard.md`.
11. **Photo upload go-live gaps** — R2 lifecycle rule not actually configured yet
    (just documented), no rate limiting on upload-slot requests — see
    `/go-live-requirements/photo-upload.md`.
12. **Feature development after this** — every major feature in the original
    product scope now has at least a first pass built. What's left is mostly
    the go-live gaps above, plus anything net-new the user wants to add.

## This session (2026-08-04)
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
- The `feed_items` materialized view is refreshed via `POST /api/cron/refresh-feed` (manual/cron-triggered, `CRON_SECRET`-gated) — no automatic scheduling yet, real Inngest-based refresh is still a follow-up. Never compute the feed inline from the base tables.
- `CREATE EXTENSION IF NOT EXISTS postgis;` is included at the top of the `init` migration — any fresh DB will get PostGIS automatically.
- Node 24.15.0 is required. Managed via asdf (`.tool-versions` in home dir) and nvm (`.nvmrc` in project root).
- When running `prisma migrate` from Claude Code, Prisma requires explicit user consent via `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var for destructive operations (`reset`, `drop`).
