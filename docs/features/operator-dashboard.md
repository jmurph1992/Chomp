# Operator Dashboard

`/dashboard` and everything under it is where operators manage their trucks —
profile, menu, schedule, and current location. It's the only write-heavy,
multi-page feature in the app so far, and the first place an operator role or
a `Truck` row can be created outside the seed script.

## Getting your first truck

`/dashboard/new` — a signed-in user (any role) fills out name/description/cuisine.
`createTruckAction` → `lib/trucks.ts#createTruck`:

1. Generates a unique slug from the name (`slugify` + a numeric-suffix retry
   loop if taken).
2. Creates the `Truck`, with the caller as `ownerId`.
3. Creates a `TruckOperator(role: owner)` row.
4. Upgrades the caller's `User.role` to `operator` if it's currently `customer`
   (never downgrades an existing `operator`/`admin`). This is the second
   legitimate writer of `role` — see `docs/features/auth.md#roles`.

A user can create more than one truck; there's no "only if you have none"
restriction, since the dashboard has a truck switcher (below).

## The security boundary: `requireOperator`

`apps/web/lib/operators.ts#requireOperator(truckId)` is called at the top of
every `/dashboard/[truckId]/*` **page** (via the shared layout) and
independently inside every **server action** that touches a specific truck's
data. It resolves the signed-in user and checks a `TruckOperator` row exists
for *that exact truckId* — not "is this user an operator of anything."

This two-places-check matters: the layout only protects rendering. A server
action is independently callable (someone could open dev tools and call
`updateTruckProfileAction('someone-elses-truck-id', ...)` directly), so every
action re-checks from scratch. Page-level checks and action-level checks are
both load-bearing, not redundant.

**Manager parity**: any `TruckOperator` row — `owner` or `manager` — passes
`requireOperator` equally. An owner can now actually add a manager via the
invite flow (`/dashboard/[truckId]/team`) — see
`/docs/features/manager-invites.md` — which is the only product-facing path
that creates a `manager` row (besides the seed script and Prisma Studio).

## Closing an IDOR gap in the menu/schedule CRUD

`requireOperator(truckId)` only proves the caller operates *some* truck with
that id — it says nothing about whether a `categoryId`/`itemId`/`entryId` the
client also sent actually belongs to that truck. Every mutation in
`lib/menu.ts` and `lib/schedule.ts` scopes its `where` clause by **both** the
record id **and** `truckId` (using `updateMany`/`deleteMany` instead of a
plain unique `where`, since Prisma's typed `update`/`delete` only accept
actual unique-constraint fields). "0 rows affected" and "belongs to a
different truck" produce the same "not found" error — the caller can't
distinguish "this id doesn't exist" from "this id isn't yours." See the
comment block at the top of the CRUD section in `lib/menu.ts` for the full
rationale; `lib/schedule.ts` points back to it rather than repeating it.

`deleteMenuCategory` additionally blocks deleting a non-empty category with a
clear error, rather than letting a raw FK constraint violation surface — no
cascade is configured in the schema.

## Location updates

`/dashboard/[truckId]/location` uses the same `navigator.geolocation` API the
customer-facing map already uses (`apps/web/components/truck-map.tsx`), not a
typed-address-to-coordinates flow — geocoding free text is its own
integration (Mapbox Geocoding API, ambiguous-address handling) not pulled in
here. Coordinates are what make a truck findable on the customer map
(`getNearbyTrucks` requires `geom`), so they're required; the address field is
just for display. `postLocation` retires the previous `isCurrent` row and
inserts the new one inside a transaction.

## Truck switcher

`/dashboard` lists every truck the signed-in user operates (owner or
manager); zero trucks shows a "Create your truck" CTA instead of a list. The
`[truckId]/layout.tsx` also renders a switcher (`TruckSwitcher`, a small
client component — needed for the `<select onChange>`, which a Server
Component can't do) if the user operates more than one truck.

## Ownership transfer

An owner can hand a truck off to one of its existing managers — the only way
to step back from a truck short of deactivating it entirely
(`isActive: false`, which takes it off the map for everyone, managers
included). Built as an **offer/accept** flow, not an instant swap, since
ownership carries real responsibility: the owner picks a manager and
initiates, but the transfer only actually happens once that manager
explicitly accepts — mirroring the manager-invite flow's own explicit-accept
step, just without an email/token since both people already have accounts
and a relationship to this exact truck.

- **Data model**: one nullable column, `Truck.pendingOwnerId` (FK → `users.id`,
  `ON DELETE SET NULL`, migration `20260810203148_add_truck_pending_owner`).
  No expiry field — unlike a `TruckInvite` link, which can leak or be
  forwarded, a pending transfer is only ever visible to the specific manager
  it names, on their own authenticated dashboard, and the owner can cancel it
  any time.
- **`lib/invites.ts`**: `initiateOwnershipTransfer`/`cancelOwnershipTransfer`
  (owner-gated at the action layer via the existing `requireOwner`),
  `acceptOwnershipTransfer`/`declineOwnershipTransfer` (gated entirely by
  "does `pendingOwnerId` match you" — the accepting user is a manager, not
  the owner, so `requireOwner` doesn't apply). `acceptOwnershipTransfer` swaps
  `Truck.ownerId` and both `TruckOperator` roles inside one transaction, with
  `updateMany` row-count checks as a race guard (same belt-and-suspenders
  idiom used throughout this file). `getPendingOwner` reuses the existing
  `TruckManagerView` shape — no new type needed.
- **`removeManager`** now also clears `pendingOwnerId` (same transaction) if
  the manager being removed is the current pending-transfer target —
  otherwise a removed manager could leave a dangling, unacceptable offer on
  the truck.
- **UI** (`/dashboard/[truckId]/team`): the owner sees a "Make owner" button
  per manager row (hidden while a transfer is already pending, replaced by a
  "transfer pending — Cancel" banner); the offered manager sees an
  accept/decline banner at the top of their own view of the same page. Same
  inline confirm pattern as `Remove`/`Cancel invite` throughout this
  component.
- **Not built**: rate limiting (not a spam vector — requires an existing
  owner + existing manager relationship on this exact truck already), an
  audit/history table (state is overwritten in place, same as every other
  status flip in the app so far).

## Truck deletion

An owner can permanently delete their truck from `/dashboard/[truckId]`'s
"Danger zone" — the only genuinely destructive action in the app (everything
else is a reversible status flip: `isActive`, `verificationStatus`,
`isVisible`). Owner-only, no admin delete power this pass.

- **Confirmation**: the owner must type the truck's exact current name before
  the delete button enables — a stronger gate than the inline Confirm/Cancel
  used everywhere else in this dashboard, proportionate to being irreversible.
  Validated again server-side in `lib/trucks.ts#deleteTruck`, not just in the UI.
- **Cascade lives at the DB level**, not in hand-written application code —
  `TruckOperator`/`TruckLocation`/`TruckSchedule`/`MenuCategory`/`MenuItem`/
  `TruckEvent` all get `onDelete: Cascade` (extending the one cascade
  precedent that already existed, `TruckInvite → Truck`), so a single
  `db.truck.delete()` cleans up every truck-owned operational row. Verified
  against the real Neon dev DB with a fully-populated throwaway truck
  (manager, location, schedule, menu category+item, event, invite, review
  with a photo and a like) — every cascade fired correctly, including the
  `MenuItem`/`MenuCategory` multi-path case (`MenuItem` has no direct cascade
  from `MenuCategory`, but is removed via its own direct `truckId → Truck`
  cascade before the `MenuCategory` FK is checked — Postgres resolves
  multi-path cascades within one statement).
- **Reviews and photos are orphaned, not deleted**: `Review.truckId` and
  `ReviewPhoto.truckId` are nullable with `onDelete: SetNull` — customer-
  authored content survives with `truckId` cleared. `getAllReviewsForAdmin`
  excludes orphaned rows (nothing left to moderate against — see
  `/docs/features/reviews.md`), but they're no longer invisible everywhere:
  `/account` (`/docs/features/account.md`) now surfaces a signed-in user's
  own reviews, orphaned ones included, with a "(deleted)" state instead of a
  link. `isVisible` is left untouched on orphaned rows — it means "hidden by
  a moderator for content reasons," a different concept from "truck no
  longer exists," so the account page can still render the review's real
  content next to the "truck deleted" state rather than hiding it.
- **Cloudflare Images cleanup**: every asset URL still attached to the truck
  (logo, cover, every menu item's photo, every review's photo) is gathered
  *before* the delete — the rows holding those URLs won't exist afterward —
  and best-effort cleaned up after the delete succeeds, reusing
  `extractCloudflareImageId`/`deleteCloudflareImage` from `lib/storage.ts`
  exactly as `lib/review-photos.ts` already does. A photo asset is deleted
  even for an orphaned (kept) `ReviewPhoto` row — nothing will ever show it
  again regardless of whether the row survives.
- **The feed needs no special handling**: `getFeedPage`'s `JOIN trucks t ON
  t.id = fi.truck_id` is an inner join, so a deleted truck's feed rows simply
  stop appearing on the very next query — no synchronous refresh required.
- **`lib/truck-validation.ts`** was split out from `lib/trucks.ts` in the
  same pass — `deleteTruck`'s Cloudflare cleanup pulls in `lib/storage.ts`'s
  Node-only deps (`node:crypto`, the AWS SDK), which broke the two client
  components (`create-truck-form.tsx`, `truck-profile-form.tsx`) that import
  pure name/description length constants from `lib/trucks.ts`. Same fix as
  the one already documented for reviews: pure validation moved to a
  zero-server-import module the client components import directly, mirroring
  `lib/review-validation.ts`.

## Scope cuts (not built this pass)

- ~~No manager-invite flow~~ **Resolved**: an owner can invite a manager by
  shareable link, see `/docs/features/manager-invites.md`.
- **No drag-to-reorder** for menu categories — new ones append to the end.
- ~~No image upload~~ **Resolved**: logo/cover and menu item photos now use
  the real upload flow (`ImageUploadField`, `/docs/features/photo-upload.md`)
  instead of paste-a-URL.
- ~~No rate limiting~~ **Resolved**: truck creation is now limited to 3/day
  per user, see `/docs/features/rate-limiting.md`.
- **Slug is immutable** after creation — avoids broken links/SEO churn and a
  whole class of uniqueness-on-update complexity for a field nothing
  currently needs to change.
- **`verificationStatus`/`verificationNote` are never operator-editable** —
  admin-only, per the schema's own comment. Every update function's accepted
  input type simply doesn't include them, rather than hiding it in the UI and
  hoping. See `/docs/features/truck-verification.md`.

## Testing

- Unit tests cover every `lib/*` function added this pass (Prisma mocked),
  with particular attention to `requireOperator`'s cross-truck rejection
  (`lib/operators.test.ts` — confirms an operator of truck A is rejected for
  truck B, not just "not signed in") and the menu/schedule CRUD's
  truckId-scoping (each mutation has a "belongs to a different truck" test,
  not just a happy path).
- Server-action tests (`app/actions/*.test.ts`) mirror the reviews pattern:
  unauthorized caller → DB never touched, authorized caller → correct lib
  function called with server-derived arguments.
- E2e (`apps/web/e2e/dashboard.spec.ts`) is deliberately modest: a signed-out
  visitor is redirected away from `/dashboard` and from a specific truck's
  dashboard. Actually creating/editing a truck as a signed-in user isn't
  e2e-tested yet — needs real Clerk test credentials, same gap noted for
  review submission in `docs/features/reviews.md`.
