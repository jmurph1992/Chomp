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
`requireOperator` equally. Nothing in this pass lets an owner actually *add* a
manager, though; that role is schema-supported and the permission check
already honors it, but there's no invite UI. A manager row only exists if
someone puts it there directly (seed script, Prisma Studio).

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

## Scope cuts (not built this pass)

- **No manager-invite flow.** Manager permission parity works once a row
  exists; nothing creates that row through the product.
- **No drag-to-reorder** for menu categories — new ones append to the end.
- **No image upload** for logo/cover/menu-item photos — pasted URLs only,
  same as the read-only menu pass. Blocked on Cloudflare R2/Images.
- **No rate limiting** on truck creation — tracked in
  `/go-live-requirements/operator-dashboard.md`.
- **Slug is immutable** after creation — avoids broken links/SEO churn and a
  whole class of uniqueness-on-update complexity for a field nothing
  currently needs to change.
- **`isVerified` is never operator-editable** — admin-only, per the schema's
  own comment. Every update function's accepted input type simply doesn't
  include it, rather than hiding it in the UI and hoping.

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
