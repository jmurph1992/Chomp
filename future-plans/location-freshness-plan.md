# Plan: Location Freshness / "Active Now"

> Status: **Planned, not yet built.** Scoped and approved 2026-08-12. Build
> straight from this plan next session — see "Sequencing" at the bottom.

## Context

Chomp's core promise is "find food trucks near you," but today a truck's posted location shows on the map/detail page indefinitely once set — there's no signal for whether it's actually still there. The `TruckLocation` model already has an `expiresAt` column (added in the very first migration) that has never been written to or read from anywhere — pure dead schema. This feature activates it: an operator posting their location now also declares how long they'll be there, and the app hides trucks whose declared window has lapsed from "nearby" results, while still showing a truck's last-known info on its own direct-link page (favorites, shared links) rather than hiding it outright everywhere.

"Freshness" here means *has the operator's self-declared presence window lapsed* — not physical movement/dwell-time detection. This is independent of the separate `TruckSchedule` (weekly posted-hours) model, which isn't touched at all; the label "Active now" is used deliberately instead of "Open now" to avoid implying it's driven by posted hours.

**Decisions locked in (from user Q&A):**
- Expired trucks are hidden entirely from `getNearbyTrucks`/the map. Still reachable via direct link, favorites, or feed — just not surfaced as "nearby."
- Freshness is computed at read time (`expiresAt IS NULL OR expiresAt > now()`) — no background job, no new infra.
- Duration is required on every post. Presets: 1h / 2h / 3h / 4h / 6h / **All day** — "All day" resolves to end of the operator's local day (computed client-side at submit time), not a no-expiry sentinel.
- **Extend**: operator can push the expiry further out without re-sharing GPS — only while the current location is still active; once expired, they must post fresh.
- Scope is the freshness feature only — no "Get Directions" link, no cuisine/dietary filtering (separate future items, not part of this plan).

## 1. `packages/utils/src/location-freshness.ts` (new)

Pure, dependency-free — same convention as the mobile-nav session's `nav-links.ts`/`dashboard-tabs.ts` (co-located test, re-exported via the barrel in `packages/utils/src/index.ts`).

```ts
export type DurationPresetId = '1h' | '2h' | '3h' | '4h' | '6h' | 'allDay'
export type DurationPreset = { id: DurationPresetId; label: string; minutes: number | null } // minutes: null only for 'allDay'

export const DURATION_PRESETS: readonly DurationPreset[] = [
  { id: '1h', label: '1 hour', minutes: 60 },
  { id: '2h', label: '2 hours', minutes: 120 },
  { id: '3h', label: '3 hours', minutes: 180 },
  { id: '4h', label: '4 hours', minutes: 240 },
  { id: '6h', label: '6 hours', minutes: 360 },
  { id: 'allDay', label: 'All day', minutes: null },
]

export function endOfLocalDay(now: Date = new Date()): Date // 23:59:59.999 on now's local calendar day — pure Date math, no browser API
export function expiresAtForPreset(presetId: DurationPresetId, now: Date = new Date()): Date

export const MAX_LOCATION_DURATION_HOURS = 48 // trust-boundary cap, see §8
export function isValidExpiresAt(expiresAt: string, now: Date = new Date()): boolean // rejects unparseable, non-future, or >48h-out
export function isLocationActive(expiresAt: string | null, now: Date = new Date()): boolean // null → true; exclusive comparison (expiresAt === now is NOT active), matches `expiresAt > now()`
```

**Tests** (`location-freshness.test.ts`): preset list shape; `expiresAtForPreset` exact offsets for each fixed preset; `allDay` at 11:58pm (→ ~2min later, same day) and at 12:01am (→ ~23h58m later, next day — the just-after-midnight edge case); `isValidExpiresAt` rejecting unparseable/past/>48h, accepting 47h; `isLocationActive` null/future/past/exactly-now cases.

## 2. Schema — no migration needed

`TruckLocation.expiresAt DateTime? @map("expires_at")` (`packages/db/prisma/schema.prisma:210`) already exists and is already applied to the dev DB (shipped in the initial migration). This task only starts writing/reading a column that's sat unused — CLAUDE.md's "never run migrations without asking" doesn't apply here since no `prisma migrate dev` is needed at all.

## 3. `packages/types/src/index.ts`

- **`PostLocationInput`** (line 233): add required `expiresAt: string` (ISO instant, computed client-side).
- **`TruckDetail`** (line 85): add `locationReportedAt: string | null` and `locationExpiresAt: string | null`. `locationReportedAt` is non-null iff a current location row exists at all (use this, not `currentAddress`, to decide whether to show any location UI — `currentAddress` can be null even with a real current row if the operator left it blank). `locationExpiresAt` null means "does not expire" (only possible for legacy pre-feature rows).
- `TruckMapMarker`: unchanged — `getNearbyTrucks` already filters expired rows out entirely, so anything reaching the client is definitionally active.

## 4. `apps/web/lib/locations.ts`

- **`postLocation`**: add `isValidExpiresAt(input.expiresAt)` validation (throws before opening the transaction, matching the existing invalid-coords pattern) and add `expires_at` to the raw-SQL `INSERT` (values: `${new Date(input.expiresAt)}`).
- **`getCurrentLocation`**: add `expiresAt` to the Prisma `select` and the returned shape (`row.expiresAt?.toISOString() ?? null`).
- **`extendLocation(truckId, expiresAt)`** (new): validates via `isValidExpiresAt`, then `db.truckLocation.updateMany({ where: { truckId, isCurrent: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, data: { expiresAt: new Date(expiresAt) } })`. Throws `'No active location to extend — post a fresh location instead'` when `result.count === 0` — this `WHERE` clause is the *real* server-side enforcement that an expired truck can't be revived by extension (the UI gate in §7 is just UX, not the security boundary). No transaction needed — a single conditional update, not two coupled writes like `postLocation`.

## 5. `apps/web/app/actions/locations.ts`

- `postLocationAction`: no body change, its type signature just widens via `PostLocationInput`.
- **`extendLocationAction(truckId, slug, expiresAt)`** (new): `requireOperator` → `extendLocation` → the same three `revalidatePath` calls `postLocationAction` already makes.

## 6. `apps/web/lib/trucks.ts`

- **`getNearbyTrucks`**: add to the existing `JOIN truck_locations tl` condition: `AND (tl.expires_at IS NULL OR tl.expires_at > now())` — Postgres's own `now()`, consistent with the file's raw-SQL/tagged-template style.
- **`getTruckBySlug`**: the `include.locations` filter (`where: { isCurrent: true }`) stays **unchanged** — it must keep returning the current row regardless of freshness, since the direct-link page shows "last known" info even when stale. Just read `reportedAt`/`expiresAt` off the existing row into the new `TruckDetail` fields.
- **Design choice — raw timestamps flow to the client, not a precomputed boolean**: the truck detail page is already forced dynamic (`getCurrentUser()` → Clerk's `auth()` reads cookies), so there's no caching concern today, but raw timestamps are still the better contract: the UI needs `reportedAt` regardless (to render "last active X ago" via the existing `timeAgo` helper), and a redundant precomputed boolean would be a second source of truth that could disagree with the timestamp it came from. `isLocationActive` gets called at render time in the presentational component (§7), matching the existing precedent of `getTodaysScheduleEntries` keeping "what does 'today' mean" out of the fetch/shape layer.

## 7. UI

- **`apps/web/components/location-status.tsx`** (new, shared, no `'use client'` needed): `{ reportedAt: string | null; expiresAt: string | null }` → renders nothing if `reportedAt` is null; a green "Active now — until {time}" badge if `isLocationActive(expiresAt)`; otherwise muted "Last active {timeAgo(reportedAt)}" text. One shared component so the customer-facing truck page and the operator's own dashboard form can't drift out of sync on what "active" looks like.
- **`apps/web/components/dashboard/location-duration-picker.tsx`** (new): small controlled client component over `DURATION_PRESETS`, reused for both the initial post and the extend action.
- **`apps/web/components/dashboard/truck-location-form.tsx`** (rewrite): `currentLocation` prop gains `expiresAt`; status display becomes `<LocationStatus reportedAt={...} expiresAt={...} />`; new `selectedPreset` state, required alongside `coords` before submit (new error: "Select how long you'll be here."); submit computes `expiresAtForPreset(selectedPreset).toISOString()`. **Extend**: shown only when `currentLocation && isLocationActive(currentLocation.expiresAt)` — reveals the same duration picker + a confirm button calling `extendLocationAction`, no geolocation prompt, no address field touched.
- **`apps/web/app/trucks/[slug]/page.tsx`**: replace the `{truck.currentAddress && (...)}` block with one gated on `truck.locationReportedAt` (not `currentAddress`), rendering `<LocationStatus>` plus the address line if present. **Bundled fix, worth calling out explicitly**: today's gate on `currentAddress` means a truck with a coords-only post (no address text entered) silently shows nothing — switching the gate to `locationReportedAt` fixes that latent gap for free since this line is already being touched. Flagging it since it's a small scope nudge beyond the literal ask, not a silent expansion.

## 8. Server-side abuse guard

`MAX_LOCATION_DURATION_HOURS = 48` + `isValidExpiresAt`, called from both `postLocation` and `extendLocation` — single validator, two write paths, same shape as `isValidLat`/`isValidLng` already being shared. 48h (not 24h) gives headroom above the legitimate worst case ("All day" posted at 12:01am → ~24h) so clock skew near midnight can't spuriously reject a real post, while still blocking anything resembling "post once, stay active for a week." `isValidExpiresAt` also rejects a non-future `expiresAt` at submission — a duration that's already lapsed the moment it's posted is meaningless, and rejecting it early gives a clearer error than silently writing a row that's immediately treated as expired everywhere else.

## 9. Tests

- **`packages/utils/src/location-freshness.test.ts`** (new) — see §1.
- **`apps/web/lib/locations.test.ts`** (extend): existing `postLocation` tests gain `expiresAt`; new "rejects an invalid expiresAt without starting a transaction" test (mirrors the invalid-coords test); `getCurrentLocation` tests extended for `expiresAt` round-tripping (both a real value and `null`); new `describe('extendLocation')` — rejects invalid expiry without updating, throws when `updateMany` resolves `{ count: 0 }`, updates correctly asserting the `where`'s `isCurrent`/`OR` clause on a `{ count: 1 }` resolve.
- **`apps/web/app/actions/locations.test.ts`** (extend): existing `input` gains `expiresAt`; new `describe('extendLocationAction')` mirroring `postLocationAction`'s existing auth-gate + pass-through tests.
- **`apps/web/lib/trucks.test.ts`** (extend): `getNearbyTrucks` — assert the joined SQL text contains the freshness condition (same pattern already used for `is_active = true`); `getTruckBySlug` — extend the mock to include `reportedAt`/`expiresAt` and assert they map onto `TruckDetail`, plus a no-current-row case asserting both come back `null`.
- **E2e**: skipped for the time-based logic itself — genuinely not practically testable without a clock-mocking harness this repo doesn't have, and this repo's e2e has no authenticated-operator session fixture at all yet (same gap noted in the mobile-nav session), so standing one up just for this would be disproportionate. Unit tests carry the correctness burden. Optional, non-blocking: if the seed-data enhancement below happens, a cheap unauthenticated smoke assertion in `truck-detail.spec.ts` (one seeded truck shows "Active now," one shows "last active") is realistic later.

## 10. Docs

- **`docs/features/map.md`**: one added sentence under "Query" — the `getNearbyTrucks` JOIN now also requires an unexpired location, so a truck whose window lapsed drops out of nearby results entirely; link to the operator-dashboard doc for the write-side detail rather than duplicating it.
- **`docs/features/operator-dashboard.md`**: rewrite "Location updates" — the required duration presets, "All day" = end-of-local-day (not no-expiry), the Extend action and its active-only constraint, and an explicit note that this is independent of `TruckSchedule` and deliberately not labeled "Open now."
- **`docs/features/truck-detail.md`**: update the current-location description to cover the "Active now" vs. muted "last active X ago" states, cross-referencing `LocationStatus`/`isLocationActive`.
- No new standalone doc file — folds into these three existing docs, same as favorites folded into `account.md` rather than getting its own file.

## 11. Sequencing

1. `packages/utils/src/location-freshness.ts` + test — fully independent, do first.
2. `packages/types/src/index.ts` — right after/alongside step 1.
3. Write path: `lib/locations.ts` + `app/actions/locations.ts` + their tests.
4. Read path: `lib/trucks.ts` + its tests — independent of step 3, could be done in parallel.
5. UI: `LocationStatus`, `LocationDurationPicker`, `truck-location-form.tsx` rewrite, truck detail page edit — depends on 1–4 all existing first.
6. Docs — last, describing as-built behavior.
7. Optional, non-blocking: seed a truck with a realistic future `expires_at` and one already-expired, for local-dev demo fidelity of the hide-from-map behavior.

## Verification

- `pnpm --filter @chomp/utils test` and `pnpm --filter web test` (Vitest) for all new/extended unit tests.
- `pnpm exec tsc --noEmit` in `apps/web` for the type changes flowing through every consumer.
- `pnpm dev`, manually: post a location with a short duration (1h) on a seeded truck's dashboard, confirm "Active now" shows on both the dashboard and the public truck page; confirm the truck appears on the map; use the Extend action and confirm the expiry moves out without a new geolocation prompt; (to verify the hide-on-expiry path without waiting an hour) verify via a direct DB check (`UPDATE truck_locations SET expires_at = now() - interval '1 minute' WHERE ...`) that the truck disappears from `/` but its own `/trucks/[slug]` page still renders with the muted "last active" state.
