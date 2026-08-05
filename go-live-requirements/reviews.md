# Reviews — go-live requirements

- ~~Rate limiting on review submission~~ — **done**, see
  `/docs/features/rate-limiting.md`. `submitReviewAction` is limited to 5/hour
  per user via Upstash Redis.
- ~~Review moderation queue~~ — **done**, see `/docs/features/reviews.md`'s
  "Moderation queue" section. `/admin/reviews` lists every review across all
  trucks with hide/unhide (both reason-required, audit-logged).
