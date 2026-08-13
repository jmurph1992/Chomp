# Plan: "Get Directions" Link

> Status: **Planned, not yet built.** Scoped 2026-08-13. Build straight from
> this plan next session — see "Sequencing" at the bottom.

## Context

Flagged during the 2026-08-13 gap-analysis (`future-plans/roadmap.md` item
7b): a customer can find a truck on the map, the list, or its detail page,
but there's no link out to an external maps app to actually navigate there —
checked the whole codebase, zero hits for anything maps/directions-related.
Core to "find food trucks near you."

**Decisions locked in (from user Q&A):**
- **Placement: the truck detail page only** this pass — not the list view or
  map popups. Keeps this feature's implementation to plain React (the list
  and the truck detail page share that already; map popups are raw DOM, a
  separate implementation, discussed and deliberately deferred rather than
  bundled in).
- **Shown regardless of freshness** — a stale ("last active X ago") location
  still gets a directions link, same reasoning already applied to
  `LocationStatus` showing last-known info rather than hiding it outright.
- **Destination**: prefer the operator's typed address when present (a
  nicer, human-readable label in the maps app); fall back to coordinates
  when it's missing (a coords-only post, same case `LocationStatus` already
  handles by showing no address line).

**Design defaults set by this plan** (implementation-level judgment calls):
- A single **Google Maps universal link**
  (`https://www.google.com/maps/dir/?api=1&destination=...`) — not separate
  Google/Apple links. This URL format opens the native app via deep-link
  handling on both iOS and Android when installed, and falls back to Google
  Maps on the web otherwise; no platform detection needed, no new
  dependency, matches this app's habit of avoiding needless client-side
  complexity.
- Opens in a new tab (`target="_blank" rel="noopener noreferrer"`) — leaving
  the app to a third-party site, standard external-link hygiene.
- Gated on `truck.locationReportedAt` (a current location row exists at
  all) — same gate `LocationStatus` already uses; no location posted ever
  means nothing to direct to.
- No new XSS surface: the address is operator-entered free text, but it
  flows through `encodeURIComponent` into a normal React `href` attribute
  (not `dangerouslySetInnerHTML`), which is safe by construction — same as
  every other place this app renders user-entered strings into an `<a>`.

## 1. A real gap in `getTruckBySlug` this plan has to fill first

`TruckDetail` has no coordinates today — `currentAddress` is the only
location field. Coordinates live in `TruckLocation.geom`, which is
`Unsupported("geography(Point, 4326)")` in Prisma (same reason
`getNearbyTrucks` already uses raw SQL for `ST_Y`/`ST_X`). The coordinate
fallback this plan needs can't be read via the existing `findUnique` at all.

**Fix**: `lib/trucks.ts#getTruckBySlug` gains a second, small raw query
(only runs when a current location row exists), alongside the existing
`db.truck.findUnique`:

```sql
SELECT ST_Y(geom::geometry) AS "lat", ST_X(geom::geometry) AS "lng"
FROM truck_locations
WHERE truck_id = ${truck.id} AND is_current = true
```

## 2. `packages/types/src/index.ts`

- **`TruckDetail`**: add `locationLat: number | null` and
  `locationLng: number | null` — null together whenever `locationReportedAt`
  is null (no current location row at all); otherwise always both populated
  (coordinates are required on every `postLocation` call, unlike address).

## 3. `packages/utils/src/directions.ts` (new)

Pure, dependency-free — same convention as `location-freshness.ts`/
`truck-list-filters.ts` (co-located test, re-exported via the barrel).

```ts
export function buildDirectionsUrl(
  address: string | null,
  lat: number | null,
  lng: number | null,
): string | null
// null if there's no destination at all (address null AND lat/lng null —
// the "never posted a location" case). Prefers address when present
// (encodeURIComponent'd); falls back to `${lat},${lng}` otherwise.
// Google Maps universal link: https://www.google.com/maps/dir/?api=1&destination=<dest>
```

**Tests** (`directions.test.ts`): address present → URL-encoded address as
destination; address null, coordinates present → `lat,lng` destination;
both null → `null`; address containing special characters (`&`, spaces,
unicode) correctly encoded, not string-concatenated unsafely.

## 4. `apps/web/lib/trucks.ts#getTruckBySlug`

Add the raw query from §1 (only when `truck.locations[0]` exists), map into
the new `locationLat`/`locationLng` fields alongside the existing
`locationReportedAt`/`locationExpiresAt` mapping.

## 5. `apps/web/app/trucks/[slug]/page.tsx`

A "Get Directions" link inside the same block that already renders
`<LocationStatus>`, gated on `truck.locationReportedAt` (matching
`LocationStatus`'s own gate — always shown once there's a current location,
regardless of freshness, per the locked-in decision above):

```tsx
{truck.locationReportedAt && (
  <div className="mt-4 space-y-1">
    {truck.currentAddress && <p><strong>Current location:</strong> {truck.currentAddress}</p>}
    <LocationStatus reportedAt={truck.locationReportedAt} expiresAt={truck.locationExpiresAt} />
    {directionsUrl && (
      <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
        Get Directions
      </a>
    )}
  </div>
)}
```

`directionsUrl` computed once via
`buildDirectionsUrl(truck.currentAddress, truck.locationLat, truck.locationLng)`
— a plain Server Component computation, no client JS needed (it's a static
`<a href>`, not an interactive button).

## 6. Tests

- **`packages/utils/src/directions.test.ts`** (new) — see §3.
- **`apps/web/lib/trucks.test.ts`** (extend): `getTruckBySlug` — mock the new
  raw-query call, assert `locationLat`/`locationLng` map onto `TruckDetail`;
  a no-current-location case asserting both come back `null` (extending the
  existing no-current-row test from the location-freshness session).

## 7. Docs

- **`docs/features/truck-detail.md`**: one paragraph under the existing
  location-freshness note — the Get Directions link, that it's
  address-preferred/coordinate-fallback, shown regardless of freshness, and
  a pointer to `packages/utils/src/directions.ts`. Note explicitly that the
  list view and map popups don't have this yet (deliberately deferred, not
  an oversight) — same style already used for other partial-surface
  features in this app's docs.
- **`future-plans/roadmap.md`**: mark item 7b done, update the summary line.

## 8. Sequencing

1. `packages/utils/src/directions.ts` + tests — fully independent, do first.
2. `packages/types/src/index.ts` — `TruckDetail` fields.
3. `lib/trucks.ts#getTruckBySlug` raw-query addition + tests.
4. UI: the link itself on the truck detail page.
5. Docs.

## Verification

- `pnpm --filter @chomp/utils test` and `pnpm --filter web test` (Vitest).
- `pnpm --filter web exec tsc --noEmit`.
- `pnpm dev`, manually (or via a throwaway Playwright check against the real
  dev DB, same pattern used to verify the list view): visit a seeded truck
  with an address, confirm the link opens Google Maps directions to that
  address; visit (or simulate) a truck with coordinates but no address text,
  confirm it falls back to a `lat,lng` destination; confirm the link still
  shows on a truck whose location has expired (muted "last active" state).
