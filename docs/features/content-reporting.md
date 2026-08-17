# Content Reporting

Roadmap item 7c, built 2026-08-17. Moderation was entirely admin-initiated
before this — `/admin/reviews` lists every review and lets an admin hide it
with a reason, but nothing let a customer flag something for attention.
This adds that trigger for both reviews and their attached photos, plus the
admin queue to triage what gets reported.

## Why not `ModerationQueueEntry`

That table's schema comment frames it as generic ("a future trigger e.g.
user-reported content can reuse this table"), but it isn't safely reusable
here: `resolveModerationEntry`/`dismissModerationEntry`
(`lib/moderation-queue.ts`) hard-code Clerk account deletion/unban/truck-
reactivation logic specific to the erasure-blocked-by-sole-ownership use
case. Triggering that from a content report would be actively dangerous.
`ContentReport` is a new, structurally similar table with its own
resolution semantics — see `packages/db/prisma/schema.prisma`'s doc comment
on the model.

## Reporting (customer-facing)

`lib/reports.ts#reportReview`/`reportReviewPhoto`:
1. Loads the target; 404s as "not found" if it's missing or already hidden
   — nothing for an admin to act on.
2. Rejects reporting your own content — a real server-side check
   (`review.userId === reporterUserId`), not just a UI-hidden button.
3. Rejects a duplicate report from the same user on the same item — a
   `findFirst` check before create, not a DB unique constraint (Postgres
   treats `NULL` as distinct in unique indexes, which doesn't cleanly
   express "exactly one of reviewId/reviewPhotoId" duplicate-checking).
4. Creates the `ContentReport` row.

`app/actions/reports.ts` resolves the reporter from `getCurrentUser()`
server-side (never client input) and rate-limits via a new `reportLimiter`
(`lib/rate-limit.ts`, 20/day per user).

`components/report-button.tsx` — shared by both review and photo reports,
`<SignedIn>`-only, hidden when the content belongs to the viewer. Fixed
reason categories (Spam / Inappropriate / Harassment / Other) plus an
optional free-text note. No visible report count anywhere — reports are
admin-only. Wired into `components/truck-reviews.tsx`, once per review and
once per attached photo.

## Photo moderation (new capability)

`ReviewPhoto` previously had `isVisible` but no way to actually flip it —
no admin hide/unhide existed for photos at all. This adds parity with
`Review`'s moderation fields (`moderationNote`, `moderatedByUserId`,
`moderatedAt`) and `lib/review-photos.ts#setReviewPhotoVisibility`, a direct
mirror of `lib/reviews.ts#setReviewVisibility`. There's no standalone
"browse all photos" admin page — deliberately out of scope; photo
moderation surfaces through the reports queue, the only place an admin has
reason to look at a photo today.

## Admin resolution

`lib/reports.ts#resolveContentReport` derives which review/photo to hide
**from the report row itself**, never from client input — an admin's
request can only ever hide the content that specific report actually
names. It hides the content via `setReviewVisibility`/
`setReviewPhotoVisibility` and doesn't separately mark the report resolved:
both of those functions already close out **every open `ContentReport` on
that item** (this one included, since it's open when this runs) as part of
hiding it, with the same resolution note. One primitive, no duplicate
update — and it means hiding a review through the *existing* `/admin/reviews`
queue also closes out any pending reports on it, keeping the two moderation
entry points from diverging. Unhiding never reopens anything.

`lib/reports.ts#dismissContentReport` is the opposite: touches only the one
report, never the content, and never cascades to other open reports on the
same item — a dismissal is a judgment on this specific report, not proof
the content itself is fine.

`/admin/reports` (`components/admin/report-queue.tsx`) lists every report,
filterable Open/Resolved/Dismissed/All, same inline-reason-input pattern as
`/admin/reviews`. Both `resolveContentReportAction`/
`dismissContentReportAction` (`app/actions/admin.ts`) are
`requireAdmin()`-gated independently of the page layout.

## Security

- Can't report your own content — server-checked, not just UI-hidden.
- Reporter identity is visible only to admins (`requireAdmin()`-gated
  reads) — never surfaced to the reported user or other customers.
- One report per user per item, checked server-side.
- `reportLimiter` rate-limits submission, same posture as every other
  create path in the app.
- `resolveContentReport` derives its target from the report row, not
  client input — closes an IDOR path where a tampered request could hide
  content unrelated to the report being acted on.
- Every admin action independently calls `requireAdmin()`.

## Scope cuts (not built this pass)

- No standalone "browse all photos" admin page (see above).
- No push/email notification to admins when a report comes in — the queue
  is pull-based, same as `/admin/reviews` and `/admin/trucks`.

## Testing

- `apps/web/lib/reports.test.ts` — own-content rejection, duplicate
  rejection, `resolveContentReport`'s IDOR-safe target derivation,
  `dismissContentReport`'s no-cascade behavior, orphaned-target exclusion
  in `getAllContentReports`.
- `apps/web/lib/review-photos.test.ts` — `setReviewPhotoVisibility`
  (mirrors `lib/reviews.test.ts`'s existing `setReviewVisibility`
  coverage) and its cross-sync closing of open reports.
- `apps/web/lib/reviews.test.ts` — extended `setReviewVisibility` with the
  same cross-sync behavior.
- `apps/web/app/actions/reports.test.ts` — sign-in + rate-limit
  call-through.
- `apps/web/app/actions/admin.test.ts` — extended with
  `resolveContentReportAction`/`dismissContentReportAction`'s
  `requireAdmin()` gating.
- No new e2e spec — matches the existing gap (`/admin/reviews` has none
  either); a manual pass against the real Neon dev DB substitutes.

## Migration

`packages/db/prisma/migrations/20260817200058_add_content_reporting` — adds
`review_photos.moderation_note`/`moderated_by_user_id`/`moderated_at`
(parity with `reviews`) and the new `content_reports` table plus its two
enums. No backfill. Applied to the Neon dev DB 2026-08-17.
