# Reviews — go-live requirements

- ~~Rate limiting on review submission~~ — **done**, see
  `/docs/features/rate-limiting.md`. `submitReviewAction` is limited to 5/hour
  per user via Upstash Redis.
- **Review moderation queue.** Admins can currently only hide a review from
  the truck page itself, one-way (see `/docs/features/reviews.md`). There's no
  way to view all hidden reviews or unhide one without going around the app
  entirely (Prisma Studio). A real admin dashboard with a moderation queue is
  needed before this is a workable moderation story at any real scale.
