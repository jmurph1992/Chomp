# Public Feed — go-live requirements

- ~~No automatic refresh scheduling~~ — **done 2026-08-05**, see
  `/docs/features/feed.md`'s "Refresh" section. `refreshFeedFunction`
  (Inngest, daily cron) replaced the old `CRON_SECRET`-gated route. **Still
  needs action before this is live in production**: create an Inngest Cloud
  app and sync the deployed `/api/inngest` URL with it once the app is
  actually deployed — until then the function only runs locally via the
  Inngest Dev Server.
- **Apply the `feed_items_item_id_key` migration** (see
  `/docs/features/feed.md`) before relying on the refresh route —
  `REFRESH MATERIALIZED VIEW CONCURRENTLY` will error without it.
