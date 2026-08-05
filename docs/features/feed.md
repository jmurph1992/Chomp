# Public Feed

`/feed` (`apps/web/app/feed/page.tsx`) is a chronological list of recent
high-rated reviews and popular photos, read from the `feed_items`
materialized view (`packages/db/prisma/migrations/20260506223040_add_feed_view`).
Public route — no sign-in required.

## Reads (`apps/web/lib/feed.ts`)

`getFeedPage(page, pageSize)` joins `feed_items` → `trucks` (for the link/
name) → `users` (for attribution) via `$queryRaw`, fetching `pageSize + 1`
rows to derive `hasMore` without a separate `COUNT(*)`. Pagination is
page-based (`?page=N`), server-rendered on each request — no client-side
fetching, consistent with the rest of the app.

## Refresh

The view only reflects reality as of its last refresh — it does **not**
auto-update as reviews/photos change.

- `refreshFeedView()` runs `REFRESH MATERIALIZED VIEW CONCURRENTLY feed_items`.
  `CONCURRENTLY` requires the unique index added in migration
  `20260731120000_add_feed_items_unique_index` — applied to the Neon dev DB as
  of 2026-08-03. A fresh database still needs `pnpm db:migrate` run against it
  before the refresh function will work; it isn't applied automatically.
- `apps/web/inngest/functions.ts#refreshFeedFunction` calls it once a day
  (`cron: '0 0 * * *'`, UTC), registered through `apps/web/app/api/inngest/route.ts`
  (Inngest's own `serve()` handler). That route is public in
  `middleware.ts` — not a Clerk-session bypass, since Inngest verifies every
  request itself via `INNGEST_SIGNING_KEY`, the same self-authenticating
  pattern as the Clerk webhook route. This replaced an earlier
  `POST /api/cron/refresh-feed` route (`CRON_SECRET`-gated, meant to be
  pointed at by Vercel Cron) — removed once Inngest took over scheduling, per
  `future-plans/roadmap.md`'s prioritized list.
- `packages/db/prisma/seed.ts` runs a **plain** (non-`CONCURRENTLY`) refresh
  at the end of seeding, so the feed has data immediately without waiting for
  the daily Inngest run — and works whether or not the unique-index migration
  has been applied yet, since plain refresh doesn't need it.

### Local dev

Run the Inngest Dev Server alongside `next dev` so the function registers and
can be triggered on demand, without needing real Inngest Cloud credentials:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

`INNGEST_DEV=1` in `apps/web/.env.local` forces the SDK into dev mode (skips
signature verification, talks to the local Dev Server) even with real
`INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` values present — unset it once
actually deploying. The Dev Server's UI (`http://localhost:8288`) lets you
manually invoke `refresh-feed` to test without waiting for the daily cron.

## Scope cuts (not built this pass)

- **No infinite scroll** — plain Previous/Next links.

## Testing

- Unit: `apps/web/lib/feed.test.ts` (`parsePageParam` validation, pagination
  math and `hasMore` derivation with Prisma mocked, `refreshFeedView`),
  `apps/web/inngest/functions.test.ts` (`refreshFeedHandler` runs
  `refreshFeedView` inside a named step; `refreshFeedFunction` registers with
  the expected id and daily cron trigger).
- E2e (`apps/web/e2e/feed.spec.ts`, gated on `DATABASE_URL` + seeded +
  refreshed data): a qualifying review renders and links to its truck; a
  **high-rated but hidden** seeded review never renders — deliberately
  high-rated so the test actually proves the view's `is_visible` filter is
  doing something, not just its `rating >= 4` filter.
- Manual/real: verified end-to-end against the actual Neon dev DB by running
  `next dev` alongside `npx inngest-cli@latest dev -u
  http://localhost:3000/api/inngest`, confirming the function registered
  (Dev Server's GraphQL API listed it), and manually invoking it — the app
  log showed the real `REFRESH MATERIALIZED VIEW CONCURRENTLY feed_items`
  query executing.

## Setup checklist

1. Apply the `feed_items_item_id_key` migration (`pnpm db:migrate`).
2. Local dev: run `npx inngest-cli@latest dev -u
   http://localhost:3000/api/inngest` alongside `next dev` (or just re-run
   `pnpm db:seed` locally, which refreshes as its last step, without needing
   Inngest running at all).
3. Production: create an Inngest Cloud app, set real `INNGEST_EVENT_KEY`/
   `INNGEST_SIGNING_KEY` in the deployment's env vars (not `INNGEST_DEV`),
   and sync the deployed `/api/inngest` URL with Inngest Cloud so the daily
   cron trigger actually fires.
