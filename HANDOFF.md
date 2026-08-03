# Chomp — Session Handoff

> This file is updated at the end of every Claude session.
> It contains everything needed to resume work immediately.

---

## Last Updated
2026-07-31

## Current Phase
**Clerk auth, map view, truck detail page (profile + schedule + menu + reviews + photos), the public feed, the operator dashboard, and photo upload (R2 + Cloudflare Images hybrid) wired up — all code-complete, need real Clerk/Mapbox/Cloudflare credentials, two applied migrations, and a seeded DB to actually run/deploy.**

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
│   │       └── migrations/   # ✅ All three migrations applied to Neon
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
cp .env.example .env.local
```
Fill in `.env.local` with:
- `DATABASE_URL` — Neon pooled connection string
- `DIRECT_URL` — Neon direct connection string (required for Prisma migrations)

Both are available in the Neon dashboard under **Connect → Connection string**.
Toggle "Pooled connection" on/off to get each one.

### 3. Apply migrations (already run — Neon DB is live)
Migrations are committed and the Neon database is already in sync.
For a fresh environment or new developer, run:
```bash
cd packages/db
pnpm db:migrate
```
Prisma will detect the existing migrations and apply them in order. No manual SQL needed.

> **Note:** The Neon DB already has all three migrations applied. Only run this
> if you're setting up a brand new database.

### 4. Start the dev server
```bash
pnpm dev
```

---

## Open Items (next things to build)
1. **Configure a real Clerk app** — create the Clerk application, fill in
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` in `.env.local`, register
   a webhook endpoint (`/api/webhooks/clerk`, events `user.created`/`user.updated`/
   `user.deleted`) and put its signing secret in `CLERK_WEBHOOK_SECRET`. Local dev
   needs a tunnel (ngrok/Clerk CLI) for Clerk to reach the webhook. **Without this,
   `next build`/`next dev` will fail** — Clerk's provider requires a syntactically
   valid publishable key even to render.
2. **Get a Mapbox token** — set `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`.
3. **Apply two migrations** — neither is applied to any database; I have no DB
   connection in this sandbox, and per the "never run migrations without asking"
   rule wouldn't have run them against your Neon DB without confirming first
   regardless:
   - `20260731120000_add_feed_items_unique_index` — `REFRESH MATERIALIZED VIEW
     CONCURRENTLY` (used by the feed refresh route) errors without it.
   - `20260803120000_add_review_photo_visibility` — adds `ReviewPhoto.isVisible`
     and rebuilds `feed_items` to filter photos by it too. Photo moderation and
     the feed's photo-visibility filtering don't work without this.
4. **Set up Cloudflare R2 + Images** — create an R2 bucket (`CLOUDFLARE_R2_*` env
   vars) with a lifecycle rule auto-expiring objects older than ~24h (nothing
   in the app cleans up an upload that's never finalized), and a Cloudflare
   Images API token (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_HASH`).
   See `/docs/features/photo-upload.md`.
5. **Seed the dev DB** — run `pnpm db:seed` (from `packages/db`) against a real dev
   database to get sample trucks, menu items, reviews, a seeded review photo with
   likes, and a refreshed feed; nothing has data without it. I have not run this
   myself — no DB was connected in this session.
6. **Set `CRON_SECRET`** and point a scheduler at `POST /api/cron/refresh-feed`
   once deployed — nothing calls it automatically yet (see `/go-live-requirements/feed.md`).
7. **Account deletion / erasure handling** — `user.deleted` webhooks are currently a
   no-op (see `/docs/features/auth.md` and `/go-live-requirements/auth.md`). Needs a
   real decision before launch.
8. **Review submission rate limiting + a real moderation queue** — both deliberately
   deferred, see `/go-live-requirements/reviews.md`.
9. **Operator dashboard go-live gaps** — no truck-creation rate limiting, no
   manager-invite flow, no way to delete a truck/transfer ownership — see
   `/go-live-requirements/operator-dashboard.md`.
10. **Photo upload go-live gaps** — R2 lifecycle rule not actually configured yet
    (just documented), no rate limiting on upload-slot requests — see
    `/go-live-requirements/photo-upload.md`.
11. **Feature development after this** — every major feature in the original
    product scope now has at least a first pass built. What's left is mostly
    the go-live gaps above, plus anything net-new the user wants to add.

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
| `20260731120000_add_feed_items_unique_index` | Unique index on `feed_items.item_id`, required for `REFRESH MATERIALIZED VIEW CONCURRENTLY` | **No — run `pnpm db:migrate` before using the feed refresh route** |
| `20260803120000_add_review_photo_visibility` | Adds `review_photos.is_visible`; rebuilds `feed_items` to filter the photo side by it too | **No — photo moderation and feed photo-visibility won't work without it** |

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
- `.env.local` is gitignored — never committed. Each developer creates their own from `.env.example`.
- The Prisma client is generated into `node_modules` — run `pnpm db:generate` after any schema changes.
- PostGIS `geography(Point, 4326)` columns use `Unsupported()` in Prisma — all geospatial queries (`ST_DWithin`, `ST_Distance`) must use `prisma.$queryRaw`.
- The `feed_items` materialized view is refreshed via `POST /api/cron/refresh-feed` (manual/cron-triggered, `CRON_SECRET`-gated) — no automatic scheduling yet, real Inngest-based refresh is still a follow-up. Never compute the feed inline from the base tables.
- `CREATE EXTENSION IF NOT EXISTS postgis;` is included at the top of the `init` migration — any fresh DB will get PostGIS automatically.
- Node 24.15.0 is required. Managed via asdf (`.tool-versions` in home dir) and nvm (`.nvmrc` in project root).
- When running `prisma migrate` from Claude Code, Prisma requires explicit user consent via `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var for destructive operations (`reset`, `drop`).
