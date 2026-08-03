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
  before the refresh route will work; it isn't applied automatically.
- `POST /api/cron/refresh-feed` calls it, gated by a `CRON_SECRET` bearer
  token (not a Clerk session — added to the middleware's public allowlist for
  the same reason as the Clerk webhook route: it authenticates itself a
  different way). Nothing calls this automatically yet; point a scheduler
  (Vercel Cron, or eventually Inngest per `stack.md`'s "refreshed by a
  background job" decision) at it once deployed.
- `packages/db/prisma/seed.ts` runs a **plain** (non-`CONCURRENTLY`) refresh
  at the end of seeding, so the feed has data immediately without needing the
  cron route — and works whether or not the unique-index migration has been
  applied yet, since plain refresh doesn't need it.

## Scope cuts (not built this pass)

- **No automatic scheduling.** The refresh route exists; nothing calls it on
  a timer. Tracked in `/go-live-requirements/feed.md`.
- **The photo half will be empty for a while.** There's no photo upload or
  like flow yet (`ReviewPhoto`/`PhotoLike` have no write path). The view
  already `UNION ALL`s both sources, so once that's built, photos will start
  appearing here with no changes to this feature.
- **No infinite scroll** — plain Previous/Next links.

## Testing

- Unit: `apps/web/lib/feed.test.ts` (`parsePageParam` validation, pagination
  math and `hasMore` derivation with Prisma mocked, `refreshFeedView`),
  `apps/web/app/api/cron/refresh-feed/route.test.ts` (missing/wrong secret
  rejected before refreshing, mirroring the Clerk webhook route's test
  pattern).
- E2e (`apps/web/e2e/feed.spec.ts`, gated on `DATABASE_URL` + seeded +
  refreshed data): a qualifying review renders and links to its truck; a
  **high-rated but hidden** seeded review never renders — deliberately
  high-rated so the test actually proves the view's `is_visible` filter is
  doing something, not just its `rating >= 4` filter.

## Setup checklist

1. Apply the `feed_items_item_id_key` migration (`pnpm db:migrate`).
2. Set `CRON_SECRET` in `.env.local`.
3. Point a scheduler at `POST /api/cron/refresh-feed` with
   `Authorization: Bearer <CRON_SECRET>` (or just re-run `pnpm db:seed`
   locally, which refreshes as its last step).
