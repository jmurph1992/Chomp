# Map View

The root page (`/`) is the truck discovery map — the core customer experience.

## Two-stage location fetch

Geolocation only resolves in the browser, so the page can't be personalized on
first server render. Instead:

1. `apps/web/app/page.tsx` (RSC) fetches trucks around a **default fallback
   region** (`DEFAULT_LOCATION` in `apps/web/lib/geo.ts`, currently a Austin, TX
   placeholder) and renders immediately — no blank map, works even if geolocation
   is denied or unavailable.
2. `apps/web/components/truck-map.tsx` (client) requests
   `navigator.geolocation.getCurrentPosition()` on mount. If granted, it calls the
   `getNearbyTrucksAction` server action (`apps/web/app/actions/trucks.ts`) to
   refetch around the real coordinates and re-centers the map.

This is a one-shot client fetch triggered by a browser-only API, not polling —
`useEffect` here is wiring up `mapbox-gl` (an imperative DOM library) and calling
`navigator.geolocation`, neither of which has an RSC equivalent.

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

## Scope cuts (not built this pass)

- No live polling — matches "locations update every ~30 min," data refreshes on
  page reload or the one geolocation-triggered fetch, not on an interval.
- No city/zip search — only automatic geolocation or the default region.
- No manual "use my location" button.
- No Redis caching for the nearby-trucks query yet — there's no real traffic to
  justify it; `stack.md` still commits to Redis for location caching, revisit
  once there's a concrete perf need.

## Testing

- Unit: `apps/web/lib/geo.test.ts` (coordinate/radius validation),
  `apps/web/lib/trucks.test.ts#getNearbyTrucks` (with Prisma mocked).
- E2e (`apps/web/e2e/map.spec.ts`), gated on `DATABASE_URL` +
  `NEXT_PUBLIC_MAPBOX_TOKEN` + seeded data: geolocation-granted marker rendering.

## Setup checklist

1. Get a Mapbox token, set `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`.
2. Run `pnpm db:seed` (from `packages/db`) against a dev database to get sample
   trucks to look at.
