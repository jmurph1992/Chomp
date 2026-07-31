# Reviews — go-live requirements

- **Rate limiting on review submission.** `submitReviewAction`
  (`apps/web/app/actions/reviews.ts`) has no rate limiting — a signed-in user
  can call it as fast as they want. Since it's an upsert keyed on
  `(truckId, userId)`, repeated calls don't create duplicate rows, but there's
  nothing stopping abuse of the DB write path itself. Needs a real decision
  (per-user cooldown? IP-based? Something via Redis once it's wired up?)
  before launch.
- **Review moderation queue.** Admins can currently only hide a review from
  the truck page itself, one-way (see `/docs/features/reviews.md`). There's no
  way to view all hidden reviews or unhide one without going around the app
  entirely (Prisma Studio). A real admin dashboard with a moderation queue is
  needed before this is a workable moderation story at any real scale.
