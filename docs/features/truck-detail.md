# Truck Detail Page

`/trucks/[slug]` (`apps/web/app/trucks/[slug]/page.tsx`) shows one truck's
profile, schedule, and menu. 404s (`notFound()`) for unknown slugs or trucks
with `isActive: false`. Fetched in one query via
`apps/web/lib/trucks.ts#getTruckBySlug`.

## Profile & schedule

Name, cuisine, description, logo/cover image, current address (from the
current `truck_locations` row), today's schedule, and the full weekly
schedule. Logo and cover render via `next/image` with `unoptimized` (see
Images below) — added this pass; they existed as fields since the operator
dashboard but were never actually rendered on the public page until now.

**Location freshness**: the address block is gated on
`truck.locationReportedAt` (non-null iff a current location row exists at
all), not `currentAddress` — a coords-only post with no address text
entered still shows a status, it just skips the address line.
`<LocationStatus>` (`apps/web/components/location-status.tsx`) renders a
green "Active now — until {time}" badge when `isLocationActive(expiresAt)`
(the operator's declared presence window hasn't lapsed), or a muted "Last
active {timeAgo}" line otherwise. Unlike the map, an expired location still
shows here — this page is reachable via direct link, favorites, or the feed
regardless of freshness; only "nearby" results hide it. See
[`/docs/features/operator-dashboard.md#location-updates`](./operator-dashboard.md#location-updates)
for the write side.

**Scope cut**: no computed "open now" boolean — the schema has no per-truck
timezone, so schedule times are shown as plain text
(`apps/web/lib/schedule.ts#getTodaysScheduleEntries`) instead of a
open/closed state that would need to know what "now" means for that truck.

## Menu

Rendered by `apps/web/components/truck-menu.tsx`, grouped by
`MenuCategory` (ordered by `displayOrder`), with items ordered by creation
time. Only `isAvailable: true` items are fetched at all — the query in
`getTruckBySlug` filters them out server-side, they're never sent to the
client and can't be un-hidden by inspecting the response.

- **Price**: `MenuItem.price` is `Decimal(8,2)` — whole dollars (e.g. `12.50`),
  not cents. Converted with `.toNumber()` and formatted with
  `formatUsd` (`packages/utils`). Don't reuse `formatPrice` here — it assumes
  integer cents and would silently divide by 100.
- **Images**: rendered via `next/image` with `unoptimized`. Originally chosen
  to avoid allowlisting arbitrary hosts in `next.config.ts` before an upload
  pipeline existed; now that images (menu item photos, logo/cover — see
  `/docs/features/photo-upload.md`) come from `imagedelivery.net` (Cloudflare
  Images, already resizes via variants), `unoptimized` stays for a different
  reason — Next re-optimizing an already-resized image would be redundant.
- **Dietary filter chips**: `apps/web/lib/menu.ts` has the actual filtering
  logic (`getUniqueDietaryFlags`, `filterMenuByDietaryFlags`), kept out of the
  component so it's unit-testable without a component-testing setup. Selecting
  multiple flags narrows with **AND**, not OR — an item must have every
  selected flag (dietary restrictions compose: vegan *and* gluten-free both
  required), not just any one of them. Categories with no matching items are
  dropped from the filtered view entirely.
- **Favorites**: a heart toggle next to the truck name
  (`components/truck-favorite-button.tsx`) and one per menu item (inside
  `truck-menu.tsx`), both `<SignedIn>`-only, no public count — see
  [`/docs/features/account.md#favorites`](./account.md). `MenuItemView.isFavorited`
  is optional, not required — this type is shared with `lib/menu.ts#getMenuForEdit`
  (the operator dashboard's own menu editor), which has no viewer/favoriting
  concept at all; only the public `getTruckBySlug` path ever sets it.

## Scope cuts

- No "sold out" state — unavailable items are hidden, not shown with a badge.

Operator CRUD for menu items/profile (`/docs/features/operator-dashboard.md`),
reviews (`/docs/features/reviews.md`), and photo upload
(`/docs/features/photo-upload.md`) were all originally deferred from this
page's first pass — all three now exist as their own features.

## Testing

- Unit: `apps/web/lib/trucks.test.ts#getTruckBySlug` (mapping, price
  conversion, the `isAvailable`/`displayOrder` query shape, 404 on missing
  truck), `apps/web/lib/schedule.test.ts`, `apps/web/lib/menu.test.ts`.
- E2e (`apps/web/e2e/truck-detail.spec.ts`), gated on `DATABASE_URL` + seeded
  data: page render, 404 for unknown slug, menu items render (excluding the
  seeded unavailable item), and filter-chip narrowing.

## Seed data

`packages/db/prisma/seed.ts` gives "Taco Kings" and "Pho Real" full menus
(including one `isAvailable: false` item and a mix of dietary flags, to
exercise both the hide-unavailable and filter-chip behavior); the rest of the
seeded trucks have no menu, matching the real case of a truck that hasn't set
one up yet.
