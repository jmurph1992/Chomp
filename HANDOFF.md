# Chomp — Session Handoff

> This file is updated at the end of every Claude session.
> It contains everything needed to resume work immediately.

---

## Last Updated
2026-07-31

## Current Phase
**Clerk auth, map view, truck detail page (profile + schedule + menu + reviews), and the public feed wired up — all code-complete, need real Clerk/Mapbox credentials, an applied migration, and a seeded DB to actually run/deploy.**

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
- **Storage**: Cloudflare R2 + Cloudflare Images (not yet wired up)
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
3. **Apply the new migration** — `20260731120000_add_feed_items_unique_index`
   (`pnpm db:migrate` from `packages/db`) is written but **not applied to any
   database** — I have no DB connection in this sandbox, so I could not run it
   myself, and per the "never run migrations without asking" rule I wouldn't
   have run it against your Neon DB without confirming first regardless.
   `REFRESH MATERIALIZED VIEW CONCURRENTLY` (used by the feed refresh route)
   will error until this is applied.
4. **Seed the dev DB** — run `pnpm db:seed` (from `packages/db`) against a real dev
   database to get sample trucks, menu items, reviews, and a refreshed feed; nothing
   has data without it. I have not run this myself — no DB was connected in this
   session.
5. **Set `CRON_SECRET`** and point a scheduler at `POST /api/cron/refresh-feed`
   once deployed — nothing calls it automatically yet (see `/go-live-requirements/feed.md`).
6. **Account deletion / erasure handling** — `user.deleted` webhooks are currently a
   no-op (see `/docs/features/auth.md` and `/go-live-requirements/auth.md`). Needs a
   real decision before launch.
7. **Operator upgrade flow** — nothing self-service exists yet to go from `customer` to
   `operator`; every new user is `customer` by default.
8. **Review submission rate limiting + a real moderation queue** — both deliberately
   deferred, see `/go-live-requirements/reviews.md`.
9. **Feature development after this** — photo upload (blocked on Cloudflare R2/
   Images) and the operator dashboard (menu CRUD + moderation queue would both live
   there) are the two big remaining pieces.

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
  one-way from this page — no unhide UI, no moderation queue yet. No photo
  upload (blocked on Cloudflare R2/Images) and no rate limiting yet — both
  tracked in `/go-live-requirements/reviews.md`.
- `packages/db/prisma/seed.ts` — manual-only seed script (`pnpm db:seed`), ~6 fake
  trucks around Austin, TX matching the map's default region; "Taco Kings" and
  "Pho Real" have full menus (including one unavailable item and mixed dietary
  flags) and reviews (including two hidden reviews on Taco Kings — one low-rated,
  one high-rated, to test the hide filter independently of the rating filter) to
  exercise all of the above. Ends with a plain (non-`CONCURRENTLY`) feed refresh.
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
- The photo half of the feed will render nothing until photo upload/likes exist —
  expected, not a bug; the view already unions both sources.
- Full details in `/docs/features/feed.md`; go-live gaps in `/go-live-requirements/feed.md`.

## Testing infra (this session + earlier)
- Vitest configs added for `apps/web` and `packages/utils`; Playwright config for
  `apps/web`. 67 unit tests total (webhook handler, geo validation, schedule
  filtering, truck queries, menu filtering, reviews queries + actions, feed
  pagination + refresh, shared utils).
- `apps/web/e2e/auth.spec.ts`, `map.spec.ts`, `truck-detail.spec.ts`, and
  `feed.spec.ts` each have specs that only run once real Clerk/Mapbox/DB env vars
  and seed data are present — see the "Testing" section of the corresponding
  `/docs/features/*.md`. Actually submitting a review as a signed-in user isn't
  e2e-tested yet — needs real Clerk test credentials (`@clerk/testing`), same
  prerequisite as the auth spec's sign-in widget test.
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
