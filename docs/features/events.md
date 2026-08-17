# Events

Roadmap item 7a, built 2026-08-17. `TruckEvent` existed fully in the schema
since the original migration (title, description, start/end, address, geom)
but had zero UI, API, or docs — the original product scope named "weekly
schedule, menu, **events**" as a core operator capability. This wires it up:
operator CRUD, public display on the truck's own page and the feed, geocoded
coordinates for a "Get Directions" link, and an opt-in notification.

## Dashboard CRUD

`/dashboard/[truckId]/events` — full create/edit/delete, same
`requireOperator` + truckId-scoped `updateMany`/`deleteMany` IDOR pattern as
`lib/menu.ts`/`lib/schedule.ts` (see
[`/docs/features/operator-dashboard.md`](./operator-dashboard.md#closing-an-idor-gap-in-the-menuschedule-crud)).
`createEventAction` is additionally rate-limited (`eventLimiter`, 10/day per
operator — same order of magnitude as `inviteLimiter`), same abuse-prevention
posture as every other create path in the app.

Title is the only required field; start/end date-time and address are all
optional independently — a title-only announcement is valid.
`lib/events.ts#createEvent`/`updateEvent` reject an empty title and an
`endsAt` at or before `startsAt`.

## Geocoding

Typed event addresses are geocoded server-side via Mapbox's Geocoding API
(`lib/geocoding.ts#geocodeAddress`), reusing the existing
`NEXT_PUBLIC_MAPBOX_TOKEN` rather than a new secret — Mapbox public tokens
are scoped for this kind of read, same token `TruckMap` already uses
client-side. Only the top match is used; there's no disambiguation step.

A geocoding miss or failure **never blocks event creation** — it just means
no pin, address text still saves. `geom` is `Unsupported()` in Prisma (same
as `TruckLocation.geom`), so it's written via a follow-up raw `UPDATE`
after the row exists, same two-step pattern
`lib/locations.ts#postLocation` uses for its `INSERT`.

## Public display

**Truck detail page**: a new "Upcoming Events" section
(`components/truck-events.tsx`) below the weekly schedule. "Upcoming" means
no end date (an evergreen announcement) or an end date that hasn't passed
yet — `lib/events.ts#getUpcomingEventsForTruck`, same "still current" framing
`postLocation`'s activation check already uses for `expiresAt`. Each event
gets a "Get Directions" link via the same `buildDirectionsUrl`
(`packages/utils/src/directions.ts`) the profile section uses —
address-preferred, coordinate fallback. No section renders at all with zero
upcoming events, same "hide empty state" convention menu categories follow.

**Feed** (`/feed`): a small "Upcoming Events" block, queried **live** on
every request via `getUpcomingEventsForFeed` — deliberately **not** folded
into the `feed_items` materialized view, which only refreshes once a day.
An event announced today (e.g. "tomorrow's pop-up") would be stale for up to
24h going through that view; this bypasses it entirely. No pagination —
capped at 10, a small supplementary section, not the main feed list. The
cross-truck query filters `trucks.is_active = true AND
trucks.verification_status = 'verified'`, the same visibility gate
`getTruckBySlug`/`getNearbyTrucks` already enforce, so a deactivated or
unverified truck's event can't leak into the feed even though this bypasses
the view's own filtering.

**Map**: deliberately **not** built this pass — same reasoning Get
Directions (7b) used to skip the map's popups: they're raw DOM, a separate
implementation from the truck page's plain React.

## Notification

Opt-in **per truck**, toggled on the truck's own detail page
(`components/truck-event-notify-toggle.tsx`) — unlike
`favorite-notifications.md`'s `notifyFavoriteActive` (a `User`-level
preference covering every favorited truck), this is a new
`TruckFavorite.notifyNewEvents` column, since it's meaningful per truck, not
globally. The toggle is only rendered once the truck is already favorited,
and `updateEventNotifyPreferenceAction`'s `updateMany` (scoped to `{
truckId, userId }`) enforces "must favorite first" server-side regardless —
0 rows affected throws, same as every other IDOR-scoped mutation in the app.

`createEvent` fires `app/truck.event-created` (fire-and-forget, `truckId` +
`eventId`) after the row exists — no transaction-racing concern here, unlike
`postLocation`'s activation check, since there's no prior state this needs
to read atomically with the write.
`notifyFavoritesOnNewEventFunction` (`apps/web/inngest/functions.ts`) picks
it up: loads the truck and event fresh (no-ops if either was deleted since
the event fired), loads opted-in favoriter emails
(`getEventNotifyOptedInEmails`), and sends one email per recipient via
`sendEmail` — `Promise.allSettled`, so one bad address doesn't fail the run
and trigger a retry that re-emails everyone else. Registered in
`apps/web/app/api/inngest/route.ts` alongside the existing functions.

## Security

- Every dashboard mutation re-checks `requireOperator(truckId)`
  independently (page-level layout checks alone aren't sufficient — see
  `/docs/features/operator-dashboard.md#the-security-boundary-requireoperator`),
  and every `lib/events.ts` mutation scopes its `where` by both the record
  id and `truckId`.
- `getUpcomingEventsForFeed`'s truck join enforces the same
  `isActive`/`verificationStatus` gate the truck detail page and map already
  use — a deactivated or unverified truck's event never appears in the feed.
- Notification recipient emails come from `User.email` (Clerk-synced),
  resolved server-side inside the Inngest handler, never from client input
  — same standing rule `/docs/features/email.md` documents.
- `geocodeAddress` URL-encodes the operator-typed address before sending it
  to Mapbox — no injection surface — and degrades to `null` on any failure
  rather than surfacing an error in the wrong place.
- `notifyNewEvents` defaults to `false` (migration has no backfill) and can
  only be toggled on the caller's own `TruckFavorite` row for a truck
  they've actually favorited.

## Scope cuts (not built this pass)

- No map pins for events (see "Public display" above).
- No address-confirmation step for geocoding — the top match is
  auto-accepted.
- No recurring events — the schema (and this feature) only support a single
  start/end window per event, matching `TruckEvent`'s existing shape.

## Testing

- `apps/web/lib/geocoding.test.ts` — top-match parsing, no-match/non-2xx/
  thrown-fetch all resolve to `null`.
- `apps/web/lib/events.test.ts` — CRUD IDOR scoping, title/date validation,
  geocode-hit/miss branches on create and update, the "upcoming" date filter
  for both the truck-page and feed reads, and the
  `app/truck.event-created` Inngest send.
- `apps/web/app/actions/events.test.ts` — `requireOperator` and
  `eventLimiter` call-through on create.
- `apps/web/app/actions/favorites.test.ts` — `updateEventNotifyPreferenceAction`'s
  own-row-only scoping and not-favorited-throws case.
- `apps/web/lib/favorite-notifications.test.ts` — `getEventNotifyOptedInEmails`/
  `newEventEmailHtml`.
- `apps/web/inngest/functions.test.ts` —
  `notifyFavoritesOnNewEventHandler`: no-ops on a deleted truck or event,
  sends one email per opted-in recipient, one failed send doesn't stop the
  others.
- `apps/web/lib/trucks.test.ts` — `getTruckBySlug` includes `upcomingEvents`
  and the viewer's own `notifyNewEvents` preference.
- No new e2e spec — same gap `favorite-notifications.md` has, since it needs
  a live Inngest Dev Server; a manual pass against the real Neon dev DB
  substitutes.

## Migration

`packages/db/prisma/migrations/20260817184420_add_notify_new_events` — adds
`truck_favorites.notify_new_events BOOLEAN NOT NULL DEFAULT false`, no
backfill. Applied to the Neon dev DB 2026-08-17. `TruckEvent` itself needed
no schema change — it's been fully migrated since `20260506222654_init`.
