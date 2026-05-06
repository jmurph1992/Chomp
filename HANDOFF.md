# Chomp — Session Handoff

> This file is updated at the end of every Claude session.
> It contains everything needed to resume work immediately.

---

## Last Updated
2026-05-06

## Current Phase
**Monorepo scaffolded. DB migration pending — must be run locally.**

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
nvm use          # switches to Node 24.15.0 via .nvmrc
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

### 3. Run the database migration
```bash
cd packages/db
pnpm db:migrate
```
This runs `prisma migrate dev` and will prompt for a migration name — use `init`.

### 4. Run the PostGIS spatial index migration
After the main migration completes, a second migration is needed for the partial
GiST index (Prisma can't express this in the schema file). Run:
```bash
pnpm db:migrate
```
Name it `add_gist_index`. Prisma will open the migration file for you to edit —
paste this SQL into it before confirming:
```sql
CREATE INDEX ON truck_locations USING GIST (geom) WHERE is_current = true;
```

### 5. Run the feed materialized view migration
Run one more migration — name it `add_feed_view` — with this SQL:
```sql
CREATE MATERIALIZED VIEW feed_items AS
  SELECT 'review' AS type, r.id AS item_id, r.truck_id, r.user_id,
    r.rating, r.body AS content, null::text AS image_url, r.created_at
  FROM reviews r
  WHERE r.rating >= 4 AND r.created_at > now() - interval '30 days' AND r.is_visible = true
  UNION ALL
  SELECT 'photo' AS type, rp.id AS item_id, rp.truck_id, rp.user_id,
    null::int AS rating, rp.caption AS content, rp.url AS image_url, rp.created_at
  FROM review_photos rp
  WHERE rp.likes_count >= 2 AND rp.created_at > now() - interval '30 days'
  ORDER BY created_at DESC;

CREATE INDEX ON feed_items (truck_id, created_at DESC);
```

### 6. Start the dev server
```bash
cd apps/web
pnpm dev
# or from root:
pnpm dev
```

---

## Open Items (next things to build)
1. **DB migration** — must be run locally (see steps above). This environment cannot reach external databases on port 5432.
2. **Clerk auth setup** — install `@clerk/nextjs`, wrap layout in `<ClerkProvider>`, add middleware, create webhook to sync users to `users` table
3. **Feature development** — map view is the core customer experience, start there after auth is wired up

---

## Key Files to Review
- `/docs/README.md` — documentation table of contents
- `/docs/architecture/stack.md` — all tech decisions
- `/docs/architecture/schema.md` — full DB schema with design notes
- `/packages/db/prisma/schema.prisma` — Prisma schema (source of truth for DB)
- `/packages/db/src/index.ts` — Prisma client singleton
- `/.env.example` — all required environment variables
- `/CLAUDE.md` — rules Claude must follow on this project

---

## Notes
- `.env.local` is gitignored — never committed. Each developer creates their own from `.env.example`.
- The Prisma client is generated into `node_modules` — run `pnpm db:generate` after any schema changes.
- PostGIS `geography(Point, 4326)` columns use `Unsupported()` in Prisma — all geospatial queries (`ST_DWithin`, `ST_Distance`) must use `prisma.$queryRaw`.
- The `feed_items` materialized view must be refreshed by an Inngest background job (not yet built) — never compute inline.
