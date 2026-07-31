# Reviews

Reviews render inline on `/trucks/[slug]` (`apps/web/components/truck-reviews.tsx`),
alongside the profile/schedule/menu sections. One review per user per truck,
enforced by the existing `@@unique([truckId, userId])` on `Review`.

## Data layer

`apps/web/lib/reviews.ts`:

- `getVisibleReviewsForTruck(truckId)` / `getReviewSummary(truckId)` — public,
  always filtered to `isVisible: true`.
- `getOwnReview(truckId, userId)` — **not** filtered by `isVisible`. A user must
  always be able to see/edit/delete their own review even if a moderator hid
  it. This is the one place in the codebase where an individual review's
  visibility is intentionally bypassed — never reuse this function for
  anything other than the acting user's own review.
- `upsertReview` / `deleteReview` — keyed on `truckId_userId`, so resubmitting
  updates in place rather than erroring on the unique constraint.
- `setReviewVisibility(reviewId, isVisible)` — the moderation primitive. No
  permission check inside it; the caller (the server action) is responsible
  for checking `canModerateReviews(role)` first.

## Ownership & moderation (security)

- Every write action (`apps/web/app/actions/reviews.ts`) re-derives the acting
  user from the Clerk session server-side (`getCurrentUser()`) and scopes the
  DB write to that user's id. The client only ever sends `truckId`/`rating`/
  `body`/`reviewId` — never a user id, and never a role.
- `setReviewVisibilityAction` additionally requires `canModerateReviews(role)`
  (i.e. `role === 'admin'`) on the server-resolved user before calling
  `setReviewVisibility`. A non-admin (or signed-out) caller is rejected before
  anything is touched.
- Rating is validated with `isValidRating` (`packages/utils`, already used
  elsewhere); review body has a server-side max length
  (`MAX_REVIEW_BODY_LENGTH`, `apps/web/lib/reviews.ts`). Client-side validation
  in the form is UX only — the server action re-validates regardless of what
  the client sent.
- Review bodies render as plain JSX text — no `dangerouslySetInnerHTML`, no
  markdown/rich text in v1.

## Scope cuts (not built this pass)

- **No photo upload.** Reviews are text + rating only. `ReviewPhoto`/`PhotoLike`
  exist in the schema but nothing writes to them yet — blocked on Cloudflare
  R2/Images being wired up as its own piece of work.
- **Moderation is one-way from this page.** An admin can hide a review (it
  then disappears from the visible list, per `getVisibleReviewsForTruck`'s
  filter), but there's no unhide UI here — once hidden, restoring it requires
  going around this page (Prisma Studio, or a future admin dashboard with a
  real moderation queue). This was a deliberate "minimal admin action" scope
  cut, not an oversight.
- **No rate limiting.** Nothing stops a signed-in user from submitting review
  updates repeatedly — tracked in `/go-live-requirements/reviews.md`.
- **No restriction on reviewing your own truck.** Not enforced by the schema
  or the action layer; not building it now.

## Testing

- Unit: `apps/web/lib/reviews.test.ts` (all query/mutation functions, Prisma
  mocked; validation helpers; the `canModerateReviews` permission check) and
  `apps/web/app/actions/reviews.test.ts` (auth/ownership/admin rejection paths,
  mirroring the webhook route's test pattern).
- E2e (`apps/web/e2e/truck-detail.spec.ts`, gated on `DATABASE_URL` + seed
  data): visible reviews and average rating render, a hidden seeded review
  never renders, and a signed-out visitor sees the sign-in prompt instead of
  the form. Actually submitting a review as a signed-in user isn't covered
  yet — would need real Clerk test credentials (`@clerk/testing`), same
  prerequisite as the auth e2e spec's sign-in widget test.

## Seed data

`packages/db/prisma/seed.ts` adds two fake "customer" reviewers (distinct from
truck owners) and a few reviews on Taco Kings and Pho Real, including one
`isVisible: false` row on Taco Kings to exercise the hide filter end to end.
