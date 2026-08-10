# Account page

`/account` is where a signed-in customer manages their profile and sees
everything they've saved and written — the first (and so far only)
customer-facing account section in the app. Phase 1 (profile details +
reviews) and Phase 2 (favorites — saved trucks and menu items) are both
done.

## Why a catch-all route

`app/account/[[...rest]]/page.tsx` — not a stylistic choice. Clerk's
`<UserProfile />` component (see below) has its own internal sub-navigation
(account/security tabs) that pushes sub-paths under wherever it's mounted;
`routing="path"` needs a matching catch-all to resolve those, exactly the
same reason `/sign-in` and `/sign-up` are already `[[...sign-in]]`/
`[[...sign-up]]` catch-alls.

Not in `middleware.ts`'s public allowlist — protected by default, same as
`/dashboard`. The page itself still resolves `getCurrentUser()` and calls
`notFound()` if it's somehow null (matches the dashboard layout's idiom) —
should only happen in the rare pre-webhook-sync race, since middleware
already guarantees a session exists.

## Profile details

Embeds Clerk's own `<UserProfile routing="path" path="/account" />` inline,
rather than building custom edit forms. Clerk already owns
credentials/profile (`/docs/features/auth.md`) and provides this exact UI
for free; a custom form would mean also calling Clerk's Backend API to push
changes back, a new integration surface for something already solved. Edits
flow back through the existing `user.updated` webhook sync
(`apps/web/lib/clerk-webhook.ts`) — no new code needed there.

## Reviews

`apps/web/lib/reviews.ts#getReviewsForUser(userId)` — every review a user
has written, across all trucks, newest first, rendered by
`components/account/my-reviews.tsx`:

- **No `isVisible` filter** — same reasoning as `getOwnReview` (the
  truck-page equivalent): a user must always see their own review even if a
  moderator hid it. The list shows a "Hidden by moderator" badge rather than
  silently omitting it.
- **Includes orphaned reviews** — a review whose truck was later deleted
  (`truckId: null`, see `/docs/features/operator-dashboard.md#truck-deletion`)
  shows here with a "(deleted)" label instead of a link. This is the entire
  reason this page exists: before it, an orphaned review was invisible
  everywhere in the product, kept in Postgres for record-keeping only.
- **Read-only** — editing/deleting still happens on the truck's own page
  (`upsertReview`/`deleteReview`, unchanged). An orphaned review can't
  currently be edited or deleted from anywhere — `deleteReview` is keyed by
  `(truckId, userId)`, which doesn't exist once orphaned. Real gap, out of
  scope for a read-only list; flagged for the favorites/follow-up round if
  it turns out to matter.
- No pagination this pass — matches current app scale; copy `getFeedPage`'s
  pagination pattern (`/docs/features/feed.md`) if a real user ever needs it.

New type `MyReviewView` (`packages/types`) — deliberately not `ReviewView`
(whose `truckId: string` is non-nullable by design for truck-scoped views)
or `AdminReviewView` (excludes orphaned rows on purpose, the opposite of
what this page wants).

## Favorites

Two new join tables, `TruckFavorite` and `MenuItemFavorite` — a user can
save a truck and/or individual menu items independently (favoriting a dish
doesn't require favoriting the whole truck). **Private only, no public
count** — a personal save list, not a popularity signal, unlike photo likes
(`ReviewPhoto.likesCount`).

- **Cascade, unlike `PhotoLike`**: both new tables' FKs (`truckId`/
  `menuItemId`, and `userId`) are `onDelete: Cascade`. `PhotoLike` has no
  cascade (its parent `ReviewPhoto` needs manual cleanup before delete —
  `lib/review-photos.ts#removeExistingPhoto`), but a favorite has zero
  preserve-for-record-keeping value once its truck/item is gone — it should
  just disappear, same reasoning that justified `onDelete: Cascade` on
  `TruckOperator`/`TruckLocation`/etc. in the truck-deletion migration.
  Deleting a truck transitively cleans up `MenuItemFavorite` too (`Truck →
  MenuItem → MenuItemFavorite`, a 2-hop cascade) since `MenuItem → Truck`
  already cascades — verified against the real Neon dev DB with a
  fully-populated throwaway truck, same pattern as the truck-deletion
  session's cascade verification.
- **`lib/favorites.ts`**: `favoriteTruck`/`unfavoriteTruck`,
  `favoriteMenuItem`/`unfavoriteMenuItem` (scoped by `truckId` too — same
  IDOR-prevention idiom as `lib/menu.ts` — a `menuItemId` that doesn't
  belong to `truckId` is rejected), `getFavoriteTrucksForUser`/
  `getFavoriteMenuItemsForUser` for the account page. Uses `upsert` with an
  empty `update: {}` for idempotent toggling — no transaction needed, unlike
  `likePhoto`, since there's no denormalized counter to keep in sync.
- **`isFavorited` threaded into existing reads**, same pattern
  `ReviewPhoto.isLikedByViewer` already uses: `getTruckBySlug` and
  `getNearbyTrucks` both take an optional `viewerId`, and default to `''`/
  `null` respectively for an anonymous request (always `isFavorited: false`).
  `MenuItemView.isFavorited` is optional, not required — that type is shared
  with `lib/menu.ts#getMenuForEdit` (the operator dashboard's menu editor),
  which has no viewer/favoriting concept at all.
- **UI**: `components/truck-favorite-button.tsx` (truck detail page) and a
  `MenuItemFavoriteButton` inside `components/truck-menu.tsx` (per item) —
  both `<SignedIn>`-only (nothing rendered signed-out, no prompt), no local
  state, relying on `revalidatePath` + server re-render, same pattern as
  `PhotoLikeButton`/`likePhotoAction`. **The map is the one genuinely
  different surface**: Mapbox popups (`components/truck-map.tsx`) are raw
  DOM (`document.createElement`), not React, so there's no
  revalidate-and-re-render available — the popup's favorite button owns and
  updates its own `textContent`/`aria-pressed` directly via a closured local
  variable after each toggle. `TruckMap` takes a `viewerSignedIn` boolean
  prop (resolved once, server-side) since there's no `<SignedIn>` context
  inside a popup to check against.
- **Account page**: `components/account/my-favorites.tsx`, two sections
  ("Favorite trucks"/"Favorite menu items"). **Unlike the reviews section,
  these rows get an unfavorite button right here** — a saved list that
  can't remove items from itself would be bad UX, and there's no separate
  "edit" page for a favorite. Not confirm-gated — removing a favorite isn't
  destructive/irreversible.
- **No rate limiting** — a toggle between two states, not content creation,
  same reasoning as photo likes.

## Navigation

A plain `<Link href="/account">Account</Link>` in `app/layout.tsx`'s header,
next to the existing "Dashboard" link — not a nav-bar overhaul. The broader
mobile-first navigation work (`future-plans/roadmap.md`) is still its own,
separately-scoped item.

## Scope cuts (not built this pass)

- **Editing/deleting a review from this page.**
- **Pagination** on the reviews list.
- **No "show only my favorites" map filter/toggle** — favoriting works on
  the map, but browsing *by* favorites is still account-page-only.
- **No notifications** (e.g. a favorited truck coming back online) — no
  infra for that yet.

## Testing

- `lib/reviews.test.ts` — `getReviewsForUser`: queries by `userId` only with
  no `isVisible` filter; maps a normal review (with photo) and an orphaned
  one (`truckId`/`truck: null`) correctly; surfaces `isVisible: false`
  rather than filtering it out.
- `lib/favorites.test.ts` — favorite/unfavorite idempotency for both
  entities, the menu-item cross-truck IDOR rejection, and both
  `getFavorite*ForUser` mappings. `app/actions/favorites.test.ts` — sign-in
  guard on all four actions. `lib/trucks.test.ts` extended for
  `getTruckBySlug`/`getNearbyTrucks`'s new `viewerId` param and `isFavorited`
  mapping, including the anonymous-viewer case.
- The `Truck → MenuItem → MenuItemFavorite` 2-hop cascade was verified
  against the real Neon dev DB with a throwaway fully-populated truck (a
  favorited truck and a favorited menu item), confirming both favorite rows
  disappear on truck delete — a mocked-Prisma unit test can't exercise a
  real multi-table cascade.
- No component-test precedent for read-only server-rendered lists in this
  codebase (the truck detail page has none either) — skipped, consistent.
- Manual/e2e: not yet exercised against a real signed-in session — same
  prerequisite gap already noted for every other Clerk-dependent flow in
  this app (needs `@clerk/testing` and/or a real browser session). Verified
  instead via a clean `pnpm build` (the route compiles, `/account/[[...rest]]`
  is listed as its own route) and a `curl` check confirming
  `middleware.ts` actually gates the route (`x-clerk-auth-status:
  signed-out` on an unauthenticated request) rather than serving the page.
