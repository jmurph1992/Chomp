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

**Get Directions**: shown alongside `<LocationStatus>` whenever there's a
current location row, regardless of freshness — a stale ("last active")
truck still gets a link, same reasoning as showing the muted status instead
of hiding it. `buildDirectionsUrl` (`packages/utils/src/directions.ts`)
builds a single Google Maps universal link
(`https://www.google.com/maps/dir/?api=1&destination=...`), preferring the
operator's typed address when present and falling back to coordinates
otherwise — coordinates aren't available on `TruckDetail` for free, since
they live in `TruckLocation.geom`
(`Unsupported("geography(Point, 4326)")` in Prisma, no `@db.Uuid` on any id
column in this schema either); `getTruckBySlug` runs a small second raw
query for `ST_Y`/`ST_X` only when a current location row exists, same
reasoning `getNearbyTrucks` already uses raw SQL for coordinates. **Truck
detail page only this pass** — the list view and map popups don't have this
link yet, deliberately deferred (the map's popups are raw DOM, a separate
implementation from this page's plain React `<a>`), not an oversight.

**"Open now"** (roadmap item 7f, built 2026-08-17): a green "Open now —
until {time}" / muted "Closed" badge (`components/open-now-status.tsx`),
computed server-side via `@chomp/utils/open-now.ts#getOpenNowStatus` from
`truck.schedule` and the new manual `Truck.timezone` field (an IANA
identifier, set on the operator's profile form — never auto-derived from a
posted location). Deliberately independent of "Active now"
(`/docs/features/operator-dashboard.md#location-updates`) — this is about
whether the truck is inside its posted weekly hours, not whether the
operator has a live, unexpired location report; the codebase's own naming
already reserves "Open now" for exactly this, distinct from "Active now."
No badge renders at all for a truck with no timezone set — falls back to
exactly the plain-text schedule display below, no regression. **Scope
cut**: same-day windows only — an entry crossing midnight (e.g. 10pm-2am)
isn't specially handled, and the `closed` state has no "opens at X"
prediction (would need a forward scan across days).

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
  `packages/utils/src/open-now.test.ts` covers the "Open now" logic itself,
  including proving real timezone-awareness (the same instant/schedule
  producing different results in two different zones), boundary
  inclusivity, and cancelled-entry exclusion.
- E2e (`apps/web/e2e/truck-detail.spec.ts`), gated on `DATABASE_URL` + seeded
  data: page render, 404 for unknown slug, menu items render (excluding the
  seeded unavailable item), and filter-chip narrowing.

## Seed data

`packages/db/prisma/seed.ts` gives "Taco Kings" and "Pho Real" full menus
(including one `isAvailable: false` item and a mix of dietary flags, to
exercise both the hide-unavailable and filter-chip behavior); the rest of the
seeded trucks have no menu, matching the real case of a truck that hasn't set
one up yet.
