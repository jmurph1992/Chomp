# Search

Roadmap item 7e, built 2026-08-17. Two independent controls added to
`TruckListControls`, wired into `TruckDiscovery` (`/docs/features/map.md`).

## Two findings that shaped this

1. **`TruckLocation.city`/`state`/`zip` are dead columns.** They exist in
   the schema, but `postLocation` (`lib/locations.ts`) only ever writes a
   free-text `address` — nothing anywhere populates them. A literal
   "search these fields" feature would search columns that are always
   `NULL`.
2. **The discovery page has no unbounded truck lookup.** `getNearbyTrucks`
   is a geolocation-bounded query (radius-limited, capped at 100, requires
   a current `TruckLocation` row to appear at all), with client-side
   filters (`truck-list-filters.ts`) layered on top. There's no "find any
   truck regardless of distance" path before this.

## Name search

`lib/trucks.ts#searchTrucksByName(query)` — a real, unbounded server
search, not a client-side filter over the already-nearby set. `db.truck
.findMany` filtered to `isActive: true, verificationStatus: 'verified'`
(same visibility gate every other public read enforces) and `name: {
contains: query.trim(), mode: 'insensitive' }`, capped at
`MAX_SEARCH_RESULTS` (20), ordered by name. An empty/whitespace query
returns `[]` without querying. Returns `TruckSearchResult` — deliberately
lighter than `TruckMapMarker` (no `lat`/`lng`/`distanceMeters`/
`isFavorited`), since a matched truck may have no current location posted
at all.

`app/actions/trucks.ts#searchTrucksByNameAction` is a thin public-read
wrapper, same "no auth required" posture as `getNearbyTrucksAction`, and
deliberately **not** rate-limited — a plain indexless `contains` query,
cheap at this data volume, same precedent `getNearbyTrucksAction` already
sets for unthrottled public reads.

In the UI, a name search's results replace the Map/List toggle content
entirely with `components/truck-search-results.tsx` (name, cuisine,
current address if any, a link to the truck's own page — no favorite
toggle, no distance) until "← Back to nearby trucks" clears it. Explicit
submit only (Enter or the Search button) — no live/debounced
search-as-you-type.

## Location search ("city/zip")

Reinterpreted as **re-centering, not text-matching**, since the underlying
`city`/`zip` columns are never populated. `app/actions/trucks.ts#searchLocationAction`
geocodes the typed string via `lib/geocoding.ts#geocodeAddress` (built for
`/docs/features/events.md`'s event addresses) and, on a hit, `TruckDiscovery`
runs **the exact same two steps** its geolocation success callback already
runs — `setCenter` then `getNearbyTrucksAction` → `setTrucks` — no new
rendering path, just a second way to produce the `{ lat, lng }` input. A
miss shows an inline "Couldn't find that location" message, owned by the
form itself (`LocationSearchForm` in `truck-list-controls.tsx`), not
`TruckDiscovery`.

### Rate limiting — the first IP-keyed limiter in this app

Unlike name search, each `searchLocationAction` call is a real, metered
Mapbox Geocoding API request — same "billed external call" reasoning
`uploadSlotLimiter` already documents for Cloudflare Images ingests. But
this is also the **first action anonymous visitors can call that needs
rate limiting at all** — every existing limiter (`reviewLimiter`,
`truckCreationLimiter`, `uploadSlotLimiter`, `inviteLimiter`,
`eventLimiter`, `reportLimiter`) keys off an authenticated user id, and
this action requires no sign-in. `lib/rate-limit.ts#getClientIp` reads
`x-forwarded-for` (first address, falling back to a shared `'unknown'`
bucket when absent, e.g. local dev without a proxy in front) as the key
for a new `locationSearchLimiter` (30/hour). This is a new pattern in this
codebase, not an existing one being reused.

## Security

- Both actions are public reads — no `requireOperator`/`requireAdmin`.
- `searchTrucksByName`'s `where` filter is Prisma's parameterized
  `contains`, not raw SQL — no injection surface.
- Only `isActive: true, verificationStatus: 'verified'` trucks are ever
  returned — an unverified or deactivated truck isn't discoverable via
  search any more than it is via the map/list.
- `locationSearchLimiter` bounds Mapbox API spend per client IP.

## Scope cuts (not built this pass)

- No favorite toggle inside search results — just a link to the truck's
  own page, which has the real toggle. Keeps `TruckSearchResult`/
  `TruckSearchResults` lightweight rather than threading `viewerId` and a
  third optimistic-favorite-button implementation through a new list type.
- No live/debounced search-as-you-type.
- No global nav search box — `/docs/features/navigation.md` deliberately
  cut that; this stays scoped to the discovery page, which already owns
  all the relevant state.

## Testing

- `apps/web/lib/trucks.test.ts` — `searchTrucksByName`: empty-query
  short-circuit, the verified/active/`contains`/case-insensitive `where`
  shape, the 20-result cap, current-address mapping.
- `apps/web/app/actions/trucks.test.ts` — `searchTrucksByNameAction`
  (delegates, no auth), `searchLocationAction` (empty-query short-circuit,
  IP-keyed rate-limit call-through, delegates to `geocodeAddress`).
- `apps/web/lib/rate-limit.test.ts` — `getClientIp`'s `x-forwarded-for`
  parsing and its `'unknown'` fallback.
- No new e2e spec — matches the existing gap the map/list view itself
  already has; a manual pass against the real Neon dev DB (`next dev` +
  curl confirming both search inputs render with no server error, plus a
  throwaway script exercising `searchTrucksByName` and `geocodeAddress`
  directly against seeded data) substitutes.

## Migration

None — no schema change this pass.
