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

## Truck detail page

`/trucks/[slug]` (`apps/web/app/trucks/[slug]/page.tsx`) shows name, cuisine,
description, current address, and schedule for one truck. 404s
(`notFound()`) for unknown slugs or trucks with `isActive: false`.

## Scope cuts (not built this pass)

- No "open now" boolean — the schema has no per-truck timezone, so schedule
  times are shown as plain text instead of a computed open/closed state.
- No live polling — matches "locations update every ~30 min," data refreshes on
  page reload or the one geolocation-triggered fetch, not on an interval.
- No city/zip search — only automatic geolocation or the default region.
- No manual "use my location" button.
- No Redis caching for the nearby-trucks query yet — there's no real traffic to
  justify it; `stack.md` still commits to Redis for location caching, revisit
  once there's a concrete perf need.

## Seed data

`packages/db/prisma/seed.ts` creates ~6 fake trucks with current locations
around Austin, TX (matching `DEFAULT_LOCATION`) so the map has something to
show locally. Run manually with `pnpm db:seed` — never automatic, never wired
into migrate/deploy.

## Testing

- Unit tests: `apps/web/lib/geo.test.ts` (coordinate/radius validation),
  `apps/web/lib/schedule.test.ts` (today's-schedule filtering),
  `apps/web/lib/trucks.test.ts` (query functions, with Prisma mocked).
- E2e (`apps/web/e2e/map.spec.ts`), gated on `DATABASE_URL` +
  `NEXT_PUBLIC_MAPBOX_TOKEN` + seeded data: geolocation-granted marker
  rendering, truck detail page render, 404 for unknown slug.

## Setup checklist

1. Get a Mapbox token, set `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`.
2. Run `pnpm db:seed` (from `packages/db`) against a dev database to get sample
   trucks to look at.
