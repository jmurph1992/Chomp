# Plan: Nearby Trucks List View + Filter/Sort

> Status: **Planned, not yet built.** Scoped 2026-08-13. Build straight from
> this plan next session — see "Sequencing" at the bottom.

## Context

Flagged by the user while reviewing the location-freshness plan: alongside
the map, a list of nearby trucks ordered by distance, plus other filter/sort
options. The map already computes distance (`ST_Distance` in
`getNearbyTrucks`) — this plan surfaces the same data as a list, adds rating
as a second sort option, and adds cuisine/minimum-rating filters.

**Decisions locked in (from user Q&A):**
- **Placement**: a Map/List toggle on the existing root page (`/`) — no new
  route, no side-by-side desktop layout. Same page, same mobile-first
  surface.
- **Scope of the list = the same set the map shows.** Same query, same
  filters (verified, active, unexpired location) — not a broader "all
  nearby regardless of freshness" view. Consequence, confirmed with the
  user: **"Active now first" sorting is dropped** — every truck in this list
  already has an active location (that's what location freshness's map
  filtering guarantees), so there's nothing left to group by. Sort options
  are just **Distance** (default) and **Rating**.
- **Filters**: cuisine type and minimum rating.
- **Cuisine filter UX**: a dropdown built from the distinct `cuisineType`
  values actually present in the current nearby result set — not a fixed
  taxonomy (cuisineType is free-text today, `isValidCuisineType` in
  `lib/truck-validation.ts` only bounds length/count, doesn't constrain
  values) and not a separate DB-wide query.

**Design defaults set by this plan** (implementation-level judgment calls,
not separately asked — flagged here for review rather than silently
decided):
- List rows show a favorite toggle, matching the map popup's existing one —
  dropping it would be a regression, not a scope cut.
- Rows show rating as `★ {avg} ({count})` or "No reviews yet" when
  `reviewCount === 0`.
- Minimum-rating filter is preset buttons (3.0+ / 4.0+ / 4.5+), matching the
  existing `LocationDurationPicker` button-group visual pattern rather than
  a slider.
- Default view on page load is **Map** (preserves today's behavior/URL,
  least surprising).
- View/sort/filter selections live in local component state, not the URL —
  no shareable filtered links this pass. Worth revisiting later if that
  turns out to matter.

## 1. A real architecture gap this plan has to fix first

Today, `TruckMap` (`apps/web/components/truck-map.tsx`) owns the
geolocation-triggered truck refetch **internally** — `initialTrucks` comes
in as a prop, but the geolocation-refreshed result from
`getNearbyTrucksAction` never leaves the component; it's rendered straight
into Mapbox markers via refs, not React state. A list view needs that same,
possibly-refreshed truck array to render rows from.

**Fix**: introduce a new client wrapper, `apps/web/components/truck-discovery.tsx`,
that owns the truck array as real state and the geolocation effect (moved
out of `TruckMap`), plus the Map/List toggle and filter/sort state.
`TruckMap` becomes a controlled component — it receives `trucks` as a prop
and re-renders markers on prop change via its existing `renderMarkers`
helper, instead of calling `getNearbyTrucksAction` itself. `app/page.tsx`
renders `<TruckDiscovery initialTrucks={trucks} .../>` instead of
`<TruckMap .../>` directly.

This is a real refactor of existing, tested code (`apps/web/e2e/map.spec.ts`
exercises the geolocation-granted marker flow) — the existing e2e suite is
the regression check that the refactor didn't change map behavior, not just
the new list's own tests.

## 2. `packages/utils/src/truck-list-filters.ts` (new)

Pure, dependency-free — same convention as `location-freshness.ts`/
`nav-links.ts` (co-located test, re-exported via the barrel).

```ts
export type TruckSortBy = 'distance' | 'rating'

export function sortTrucks<T extends { distanceMeters: number; averageRating: number | null }>(
  trucks: T[],
  sortBy: TruckSortBy,
): T[]
// 'distance': ascending (data already arrives pre-sorted from SQL, but don't
// assume the caller preserves that — re-sort explicitly so this function is
// correct standalone).
// 'rating': descending by averageRating; trucks with averageRating === null
// (no reviews yet) always sort last, regardless of direction.

export function filterTrucksByCuisine<T extends { cuisineType: string[] }>(
  trucks: T[],
  selectedCuisines: string[],
): T[]
// Empty selectedCuisines = no filter (returns trucks unchanged). Otherwise
// a truck matches if it has at least one cuisineType value in
// selectedCuisines (OR, not AND — a Mexican/BBQ fusion truck should show
// under either filter).

export function filterTrucksByMinRating<T extends { averageRating: number | null }>(
  trucks: T[],
  minRating: number | null,
): T[]
// null = no filter. A non-null minRating excludes trucks with
// averageRating === null (no reviews yet) — can't compare a rating that
// doesn't exist.

export function getDistinctCuisines<T extends { cuisineType: string[] }>(trucks: T[]): string[]
// Flattened, deduped, alphabetically sorted — drives the cuisine dropdown's
// options from whatever's actually in the passed-in (already-fetched)
// truck array, not a separate query.
```

**Tests** (`truck-list-filters.test.ts`): `sortTrucks` distance ascending,
rating descending, no-reviews-sorts-last for both directions, stability on
ties; `filterTrucksByCuisine` empty selection no-op, OR-match across
multiple cuisines, no-match case; `filterTrucksByMinRating` null no-op,
excludes no-reviews trucks, boundary inclusive (`averageRating === minRating`
passes); `getDistinctCuisines` dedup + sort + empty-array case.

## 3. `packages/types/src/index.ts`

- **`TruckMapMarker`**: add `averageRating: number | null` and
  `reviewCount: number` — needed for both the rating sort/filter and to
  actually display a rating in list rows. Not something the list can compute
  client-side; it has to come from the query, same as `distanceMeters`
  already does.

## 4. `apps/web/lib/trucks.ts#getNearbyTrucks`

Add a `LEFT JOIN` aggregate subquery over `reviews`, mirroring
`getReviewSummary`'s existing `isVisible: true` filter (same "hidden
reviews don't count" rule, now applied in raw SQL instead of Prisma's
`aggregate`):

```sql
LEFT JOIN (
  SELECT truck_id, AVG(rating)::float AS avg_rating, COUNT(*) AS review_count
  FROM reviews
  WHERE is_visible = true
  GROUP BY truck_id
) r ON r.truck_id = t.id
```

`SELECT` gains `r.avg_rating AS "averageRating"` and
`COALESCE(r.review_count, 0)::int AS "reviewCount"`. No change to the
existing `ORDER BY "distanceMeters" ASC` — that stays the query's default
order; rating re-sorting happens client-side via `sortTrucks`.

**Perf note, not a blocker**: no new index is added for this — `reviews`
already has an FK-backed index on `truck_id`, and there's no real traffic
yet to justify a covering `(truck_id, is_visible)` index. Same "revisit when
there's a concrete perf need" posture already documented in
`docs/features/map.md`'s Redis-caching scope cut.

## 5. `apps/web/components/truck-discovery.tsx` (new)

Client component, replaces `TruckMap` as what `app/page.tsx` renders
directly. Owns:
- `trucks: TruckMapMarker[]` state, seeded from `initialTrucks`, updated by
  the geolocation effect (moved here from `TruckMap`).
- `view: 'map' | 'list'` state, default `'map'`, a small segmented-control
  toggle rendered above both.
- `sortBy`, `selectedCuisines`, `minRating` filter/sort state, passed to a
  new `TruckListControls` component and applied via
  `@chomp/utils/truck-list-filters` before rendering either the list or (for
  filters only — sort doesn't apply to the map) passing to `TruckMap`.
  **Filters apply to both views** — an operator's truck hidden by a cuisine
  filter should disappear from the map too, not just the list, so the two
  views stay consistent with each other while toggling.

## 6. `apps/web/components/truck-list.tsx` (new)

Plain React rows (unlike the map's raw-DOM popups — this one gets normal
`revalidatePath`-driven re-render): truck name/logo, distance
(`{(distanceMeters / 1609).toFixed(1)} mi`, matching how distance would read
elsewhere — no existing formatter for this, confirm during build whether one
already exists in `@chomp/utils`), cuisine tags, rating badge or "No reviews
yet", a link to `/trucks/[slug]`, and a favorite toggle reusing the same
`favoriteTruckAction`/`unfavoriteTruckAction` pair `TruckFavoriteButton`
already uses (not the map popup's raw-DOM pattern — this is real React, so
the standard component-state + server-action pattern applies directly).

## 7. `apps/web/components/truck-list-controls.tsx` (new)

Sort-by picker (Distance / Rating — two buttons or a `<select>`, TBD at
build time, not a product decision) and the filter UI: a cuisine
multi-select built from `getDistinctCuisines(trucks)`, and minimum-rating
preset buttons (3.0+ / 4.0+ / 4.5+ / any), styled like
`LocationDurationPicker`'s existing button-group.

## 8. Testing

- **`packages/utils/src/truck-list-filters.test.ts`** — see §2.
- **`apps/web/lib/trucks.test.ts`** (extend): `getNearbyTrucks` — assert the
  new `LEFT JOIN`/aggregate SQL text is present (same pattern already used
  for the freshness condition and `is_active = true`), and that a row with
  `averageRating`/`reviewCount` from the mock maps straight through
  (`TruckMapMarker`'s shape is a passthrough of the SQL row already, per the
  existing `getNearbyTrucks` test — just extend the fixture).
- **E2e**: extend `apps/web/e2e/map.spec.ts` to confirm the existing
  geolocation-granted marker flow still passes after the `TruckDiscovery`
  refactor (regression check, not new coverage). A new smoke test toggling
  to List view and asserting rows render is optional/non-blocking, same
  posture as location freshness's own e2e scope cut — this repo's e2e has
  no filter/sort-specific coverage precedent to match against yet.

## 9. Docs

- **`docs/features/map.md`**: new "List view" section — the toggle, that
  list and map share one filtered set (so "why did this truck disappear
  from the list when I filtered by cuisine" also explains why it disappears
  from the map), and the `TruckDiscovery`/`TruckMap` state-ownership split
  from §1 (so a future reader doesn't reintroduce the internal-refetch
  pattern this plan removes).

## 10. Sequencing

1. `packages/utils/src/truck-list-filters.ts` + tests — fully independent,
   do first.
2. `packages/types/src/index.ts` — `TruckMapMarker` fields.
3. `lib/trucks.ts#getNearbyTrucks` rating aggregate + tests — independent of
   step 1, could be done in parallel.
4. **Refactor**: `TruckDiscovery` wrapper, `TruckMap` becomes controlled,
   `app/page.tsx` updated. Do this before building the list UI — it's the
   foundation both views sit on. Re-run `map.spec.ts` immediately after to
   confirm no regression before adding anything new.
5. `TruckList` + `TruckListControls` UI, wired into `TruckDiscovery`.
6. Docs.
7. Optional, non-blocking: list-view e2e smoke test.

## Verification

- `pnpm --filter @chomp/utils test` and `pnpm --filter web test` (Vitest)
  for all new/extended unit tests.
- `pnpm --filter web exec tsc --noEmit` for the type changes flowing through
  every consumer.
- `pnpm --filter web exec playwright test map.spec.ts` — confirms the
  `TruckDiscovery` refactor didn't regress the existing geolocation/marker
  flow.
- `pnpm dev`, manually: toggle to List, confirm rows match the map's
  markers 1:1; sort by rating and confirm no-review trucks sort last in
  both directions; filter by a cuisine and confirm both the list and the
  map's markers narrow together; filter by minimum rating and confirm
  no-review trucks are excluded.
