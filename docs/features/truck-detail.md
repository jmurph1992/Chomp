# Truck Detail Page

`/trucks/[slug]` (`apps/web/app/trucks/[slug]/page.tsx`) shows one truck's
profile, schedule, and menu. 404s (`notFound()`) for unknown slugs or trucks
with `isActive: false`. Fetched in one query via
`apps/web/lib/trucks.ts#getTruckBySlug`.

## Profile & schedule

Name, cuisine, description, current address (from the current
`truck_locations` row), today's schedule, and the full weekly schedule.

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
- **Images**: rendered via `next/image` with `unoptimized`, not through Next's
  image optimizer. The optimizer fetches remote URLs server-side, so
  allowlisting arbitrary hosts in `next.config.ts` before Cloudflare
  Images defines the real pipeline would be a needless SSRF-flavored surface.
  Revisit once uploads go through Cloudflare Images.
- **Dietary filter chips**: `apps/web/lib/menu.ts` has the actual filtering
  logic (`getUniqueDietaryFlags`, `filterMenuByDietaryFlags`), kept out of the
  component so it's unit-testable without a component-testing setup. Selecting
  multiple flags narrows with **AND**, not OR — an item must have every
  selected flag (dietary restrictions compose: vegan *and* gluten-free both
  required), not just any one of them. Categories with no matching items are
  dropped from the filtered view entirely.

## Scope cuts (not built this pass)

- No operator CRUD for menu items — creating/editing happens via Prisma
  Studio or the seed script for now. There's no operator dashboard yet for
  any truck data (profile, schedule, menu), so this isn't singled out.
- No "sold out" state — unavailable items are hidden, not shown with a badge.
- No image upload flow — blocked on Cloudflare R2/Images.
- No reviews or photos yet — separate future feature.

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
