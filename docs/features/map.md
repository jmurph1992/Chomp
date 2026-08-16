# Map View

The root page (`/`) is the truck discovery map — the core customer experience.

## Two-stage location fetch

Geolocation only resolves in the browser, so the page can't be personalized on
first server render. Instead:

1. `apps/web/app/page.tsx` (RSC) fetches trucks around a **default fallback
   region** (`DEFAULT_LOCATION` in `apps/web/lib/geo.ts`, currently a Austin, TX
   placeholder) and renders immediately — no blank map, works even if geolocation
   is denied or unavailable.
2. `apps/web/components/truck-discovery.tsx` (client) requests
   `navigator.geolocation.getCurrentPosition()` on mount. If granted, it calls the
   `getNearbyTrucksAction` server action (`apps/web/app/actions/trucks.ts`) to
   refetch around the real coordinates and hands the refreshed trucks + center
   down to whichever view is showing.

This is a one-shot client fetch triggered by a browser-only API, not polling.

**State ownership** (as of the list-view addition): `TruckDiscovery` owns the
truck data, the geolocation effect, and the Map/List toggle + filter/sort
state — not `TruckMap`. `TruckMap` is a controlled component: it takes
`trucks` (the current, possibly filtered/refreshed set) and `center` (set
once geolocation resolves, to trigger a `flyTo`) as props and re-renders
Mapbox markers via `useEffect`s keyed on each. This split exists so the same
truck data and filter state can also drive `TruckList` — before the list
view, `TruckMap` fetched and rendered everything internally with no way for
a sibling component to see the result. Don't move the geolocation/fetch
logic back into `TruckMap`; that would reintroduce the exact problem this
refactor fixed.

## Query

`apps/web/lib/trucks.ts#getNearbyTrucks` uses `db.$queryRaw` with `ST_DWithin`/
`ST_Distance` (PostGIS geography columns are `Unsupported()` in Prisma — this is
the one place raw SQL is allowed, per `/docs/architecture/stack.md`). Inputs are
validated (`isValidLat`/`isValidLng`) and the radius is clamped
(`clampRadiusMeters`, max 50 miles) before hitting the database — this function is
reachable indirectly from the public server action, so it's the trust boundary.
All values are passed as Prisma tagged-template params, never string-concatenated.

Marker click-throughs land on the truck detail page — see
[`/docs/features/truck-detail.md`](./truck-detail.md).

The `JOIN truck_locations` also requires an unexpired location
(`expires_at IS NULL OR expires_at > now()`) — a truck whose operator-declared
presence window has lapsed drops out of nearby results entirely, even though
its row is still `is_active`. See
[`/docs/features/operator-dashboard.md`](./operator-dashboard.md#location-updates)
for the write-side detail ("Active now" / location freshness).

## Favorites in the popup

Each truck's popup shows a heart favorite-toggle when the viewer is signed
in — see [`/docs/features/account.md#favorites`](./account.md). `getNearbyTrucks`
takes an optional `viewerId` and `LEFT JOIN`s `truck_favorites` to compute
`isFavorited` per truck (`app/page.tsx` for the initial server render,
`getNearbyTrucksAction` for the client's geolocation re-fetch).

Mapbox popups are raw DOM (`document.createElement`), not React, so the
favorite button can't rely on the `revalidatePath` + re-render pattern used
everywhere else (`TruckFavoriteButton`, `PhotoLikeButton`) — it owns and
updates its own `textContent`/`aria-pressed` directly, via a closured local
variable, after each toggle (`buildFavoriteButton` in `truck-map.tsx`).
`TruckMap` takes a `viewerSignedIn` boolean prop, resolved once server-side,
since there's no `<SignedIn>` React context available inside a popup.

## List view

A Map/List toggle on the same root page (no separate route) — added
alongside sort/filter options, see `future-plans/nearby-list-view-plan.md`
for the full design writeup. `TruckList` (`apps/web/components/truck-list.tsx`)
renders the **exact same filtered truck set** the map shows, as plain rows
(distance, cuisine, rating, a favorite toggle) linking to each truck's page
— not a broader "everything nearby regardless of freshness" view. Sortable
by distance (default) or rating; filterable by cuisine and minimum rating.
Sorting only affects list order; filtering narrows both views at once
(`TruckDiscovery` applies `filterTrucksByCuisine`/`filterTrucksByMinRating`
from `@chomp/utils` before handing trucks to either child), so toggling
between Map and List never shows a different set of trucks, only a
different rendering of the same one.

`getNearbyTrucks` gained a `LEFT JOIN` aggregate over `reviews` (same
`is_visible = true` rule `getReviewSummary` already applies, just written in
raw SQL instead of Prisma's `aggregate`) to compute `averageRating`/
`reviewCount` per truck — needed for the rating sort/filter and to actually
display a rating in list rows; not something derivable client-side. A truck
with no (visible) reviews gets `averageRating: null`, which
`sortTrucks`/`filterTrucksByMinRating` (`@chomp/utils/truck-list-filters.ts`)
both treat specially — always sorts last, always excluded by any minimum-rating
filter, since there's no rating to compare.

Because the list's favorite button lives inside `TruckDiscovery`'s
client-held state (fetched once via geolocation, not re-fetched by
`revalidatePath`), it can't use `TruckFavoriteButton`'s no-local-state
pattern the way the truck detail page does — it owns local optimistic state
instead, the same reasoning already applied to the map popup's favorite
button, just via `useState` since this is real React rather than raw DOM
(`ListFavoriteButton` in `truck-list.tsx`).

## "My favorites" filter

A third filter alongside cuisine/rating (see `future-plans/roadmap.md` item
7g), signed-in only — the toggle in `TruckListControls` doesn't render at
all for a signed-out viewer, rather than showing disabled.

Matches a truck if the viewer favorited the truck directly **or** favorited
any of its menu items — an OR read at query time, not a write-side cascade.
An earlier "favoriting a menu item also favorites the truck" idea was
considered and rejected: it would make an "unfavorite the truck" click a
no-op whenever the truck was only ever favorited via one of its items (no
`TruckFavorite` row to delete), and it would dilute `/account`'s
explicit-favorites list with trucks the user never actually bookmarked.

`getNearbyTrucks` gained a second boolean, `hasFavoritedMenuItem`, kept
deliberately separate from `isFavorited` on `TruckMapMarker` — merging them
would break the truck-level favorite toggle button in exactly the way
above. It's computed via an `EXISTS` subquery against `menu_items` +
`menu_item_favorites`, not a `JOIN` — a `JOIN` would fan out one row per
menu item per truck and corrupt the query's one-truck-per-row cardinality
(`distanceMeters`, `averageRating`, and the `LIMIT 100` are all written
assuming one row per truck). `filterTrucksByFavorite`
(`@chomp/utils/truck-list-filters.ts`) is the pure OR of the two booleans,
same style as the other list filters.

## Scope cuts (not built this pass)

- No live polling — matches "locations update every ~30 min," data refreshes on
  page reload or the one geolocation-triggered fetch, not on an interval.
- No city/zip search — only automatic geolocation or the default region.
- No manual "use my location" button.
- No Redis caching for the nearby-trucks query yet — there's no real traffic to
  justify it; `stack.md` still commits to Redis for location caching, revisit
  once there's a concrete perf need.
- View/sort/filter selections live in local component state, not the URL —
  no shareable filtered links yet (e.g. "here's the list filtered to BBQ,
  4+ stars"). Revisit if that turns out to matter.

## Testing

- Unit: `apps/web/lib/geo.test.ts` (coordinate/radius validation),
  `apps/web/lib/trucks.test.ts#getNearbyTrucks` (with Prisma mocked, including
  the freshness condition, the rating aggregate join, and the
  `hasFavoritedMenuItem` `EXISTS` subquery),
  `packages/utils/src/truck-list-filters.test.ts` (sort/filter logic,
  including `filterTrucksByFavorite`, pure).
- E2e (`apps/web/e2e/map.spec.ts`), gated on `DATABASE_URL` +
  `NEXT_PUBLIC_MAPBOX_TOKEN` + seeded data: geolocation-granted marker
  rendering — this is also the regression check for the `TruckDiscovery`
  refactor, since it exercises the same geolocation → fetch → render path
  that moved out of `TruckMap`. No dedicated list-view e2e test yet
  (manually verified against the real dev DB during the list-view session
  instead — distance/cuisine/rating rendered correctly, toggle worked both
  directions); would be a reasonable follow-up if this page gets more
  interaction surface.

## Setup checklist

1. Get a Mapbox token, set `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`.
2. Run `pnpm db:seed` (from `packages/db`) against a dev database to get sample
   trucks to look at.
