# Public Feed — go-live requirements

- **No automatic refresh scheduling.** `POST /api/cron/refresh-feed`
  (gated by `CRON_SECRET`) exists and works, but nothing calls it on a
  timer yet. Needs either a Vercel Cron job pointed at it, or the real
  Inngest-scheduled refresh that `/docs/architecture/stack.md` already
  commits to ("refreshed by a background job") — whichever ships, the feed
  will silently go stale in production until one of them is wired up.
- **Apply the `feed_items_item_id_key` migration** (see
  `/docs/features/feed.md`) before relying on the refresh route —
  `REFRESH MATERIALIZED VIEW CONCURRENTLY` will error without it.
