# Photo Upload

Powers review photos, menu item photos, and truck logo/cover — a shared
upload primitive wired into three different surfaces. Storage is a hybrid:
Cloudflare R2 (transient intake) + Cloudflare Images (permanent store,
resizing, CDN delivery via `imagedelivery.net`).

## Why this shape

Cloudflare Images' cheapest billing tier ("remote transformations",
`$0.50/1000` beyond a free allowance) is tied to a **zone-based** feature
(`/cdn-cgi/image/...` URL rewriting) that requires putting the app's domain
on Cloudflare's DNS — a real infrastructure change that would sit awkwardly
next to Vercel hosting. The mechanism used here instead is Cloudflare
Images' **account-level "create from URL" API** (`POST
/accounts/{account_id}/images/v1` with a `url` field) — no zone required,
just an API token. Cloudflare fetches the image from wherever you point it
and keeps its own managed copy, billed at the standard hosted rate ($5/100K
stored + $1/100K delivered) — still cheap at this app's scale, just not the
absolute cheapest tier.

## The three-step flow

Different in shape from every other server action in this codebase (which
are single-call form submits) — this one requires the client to talk to R2
directly for the actual bytes, then tell the server once it's done.

1. **Request an upload slot** (`requestUploadSlotAction` →
   `lib/storage.ts#createUploadSlot`) — a presigned **POST** (not PUT) for
   R2, scoped to a unique key (`uploads/<uuid>`). Presigned POST specifically,
   because its signing policy can *declaratively enforce* content-type and a
   `content-length-range` — R2 itself rejects an upload outside those bounds,
   this isn't just a client-side check. A presigned PUT can't constrain size
   the same way.
2. **Client uploads directly to R2** using that presigned form
   (`components/use-image-upload.ts#uploadToR2`) — bytes never pass through
   the Next server, avoiding serverless body-size/timeout limits.
3. **Finalize** (`lib/storage.ts#ingestUploadedImage`):
   - Re-verifies the actual uploaded object server-side (a `HEAD` request
     confirming real size/content-type) — the POST policy is enforced by R2,
     but this is defense in depth against a misconfigured or bypassed policy.
   - Generates a short-lived presigned **GET** for that key (R2 stays fully
     private — no public bucket ever needed) and calls Cloudflare Images'
     `create` with that URL as the source.
   - Deletes the R2 object once ingestion succeeds — R2 is a transient
     intake buffer only, never the long-term store. Deletes it on ingest
     *failure* too, so nothing lingers either way.

If a client uploads to R2 via the presigned slot but never calls finalize at
all (closes the tab, network drops), that object has no *app* code path that
ever cleans it up — instead, an R2 bucket lifecycle rule on `chomp-uploads`
(`expire-orphaned-uploads`, prefix `uploads/`, delete after 1 day, configured
directly in the Cloudflare dashboard 2026-08-07) auto-expires it. This can't
be managed via the app's own R2 credentials — they're deliberately scoped to
object read/write only, not bucket administration (confirmed: both
`PutBucketLifecycleConfiguration` and its `Get` equivalent return `403` with
those credentials) — so it's dashboard-only, verified by reading the
Lifecycle Rules tab back rather than via API.

## Two shapes of client usage

- **Menu item photo, truck logo/cover** (`components/image-upload-field.tsx`
  + `use-image-upload.ts#useImageUpload`): a single call gets a ready-to-store
  URL, which just fills the same `imageUrl`/`logoUrl`/`coverUrl` field the
  existing update actions (`updateMenuItemAction`, `updateTruckProfileAction`)
  already accept. No new DB shape.
- **Review photo** (`components/truck-reviews.tsx`'s `ReviewPhotoSection`):
  can't use the same one-call hook, because `attachReviewPhotoAction` does
  the Cloudflare Images ingest *itself* as part of attaching — it needs the
  raw R2 key, not a pre-finalized URL. `uploadToR2()` (upload-only, no
  finalize) is exported separately from `use-image-upload.ts` for this case.

## Security

- **Authorization has two layers.** `requestUploadSlotAction` and
  `finalizeUploadAction` (`app/actions/uploads.ts`) don't know about
  trucks/reviews — they only require *some* signed-in caller, purely so an
  anonymous visitor can't mint successful Cloudflare Images ingests (a billed
  resource) with zero authorization anywhere in the flow. Truck-level
  authorization happens where the resulting URL is actually persisted:
  `requireOperator(truckId)` for menu/logo/cover, the caller's own review
  (never a client-supplied `reviewId`) for review photos
  (`lib/review-photos.ts#attachReviewPhoto`).
- **Validation is defense-in-depth, not client-trust**: presigned POST policy
  → server-side `HEAD` re-verification → Cloudflare Images' own validation
  that the fetched bytes are a real image (a non-image upload fails at
  ingest, before anything is ever persisted or displayed). `image/svg+xml`
  is deliberately excluded from `ALLOWED_CONTENT_TYPES` — SVGs can carry
  embedded scripts, unlike raster formats.
- **Replacing/deleting a photo cleans up its Cloudflare Images asset**
  (`deleteCloudflareImage`, best-effort — a failure here logs but never
  blocks the caller's own operation) so orphaned images don't keep accruing
  the per-stored-image fee. The image id is recovered from our own delivery
  URL (`extractCloudflareImageId`) rather than storing it as a separate DB
  column.
- **Liking is idempotent, not check-then-act.** `likePhoto` attempts the
  `PhotoLike` create directly inside a transaction with the `likesCount`
  increment, and catches the unique-constraint violation (`P2002`) as a
  no-op rather than checking existence first — closes the double-click/race
  window a naive check-then-insert would leave open. Uses the **callback**
  form of `$transaction`, not the array form — the array form requires both
  calls to be evaluated eagerly before being handed to `$transaction`, which
  is awkward to reason about (and to mock in tests) compared to an `async
  (tx) => { ... }` callback that only runs what it's given, in order.
- **Moderation**: `ReviewPhoto.isVisible` (added this pass, was explicitly
  deferred from the reviews pass to "whenever photo upload is built") mirrors
  `Review.isVisible` — filtered out of the public list, but never filtered
  out of the owner's own view. The feed's materialized view was updated in
  the same migration to filter the photo side by `is_visible` too, matching
  the review side — otherwise a hidden photo would still leak into `/feed`.

## Testing

- Unit: `lib/storage.test.ts` (content-type/size validation — including the
  actual presigned-POST policy conditions, not just the check function;
  ingest orchestration with the AWS SDK and `fetch` mocked; R2 cleanup on
  both success and ingest failure), `lib/review-photos.test.ts` (ownership
  derivation, replace-existing-photo cleanup, idempotent like/unlike,
  cross-truck rejection), `app/actions/uploads.test.ts` and
  `app/actions/review-photos.test.ts` (sign-in requirement, delegation).
- E2e: extended `truck-detail.spec.ts` (photo + like count render, no
  interactive like button when signed out) and `feed.spec.ts` (the feed's
  photo side, previously always empty, now has seeded data to actually
  render). Uploading a file through the real flow isn't e2e-tested — needs
  real Cloudflare credentials, same category of gap as Clerk-dependent flows
  elsewhere in this codebase.

## Setup checklist

1. Create an R2 bucket, set `CLOUDFLARE_R2_*` in `.env.local`, and add a
   bucket lifecycle rule to auto-expire objects older than ~24h (done for
   `chomp-uploads`, see above).
2. Create a Cloudflare Images API token, set `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_IMAGES_ACCOUNT_HASH`.
3. Apply the `20260803120000_add_review_photo_visibility` migration
   (`pnpm db:migrate`) — adds `ReviewPhoto.isVisible` and rebuilds
   `feed_items` to filter photos by it. Already applied to the Neon dev DB as
   of 2026-08-03; a fresh database still needs this step run against it.
