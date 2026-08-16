# Favorite activation notifications

Roadmap item 7d, built 2026-08-16 as the second consumer of the Resend
plumbing (`/docs/features/email.md`). Emails a truck's direct favoriters
when it goes "Active now" — the location-freshness feature
(`/docs/features/operator-dashboard.md#location-updates`) tracks whether a
truck is currently reachable, but favoriting a truck never told a customer
when that actually happened.

## Scope decisions

- **Recipients**: direct `TruckFavorite` favoriters only, not users who
  only favorited one of the truck's menu items — same "keep the two
  favorite signals separate" reasoning already applied to the map/list
  filter (`/docs/features/map.md#my-favorites-filter`).
- **Opt-in only, off by default.** Favoriting a truck does not itself
  enable these emails — a separate `User.notifyFavoriteActive` preference,
  toggled on `/account`, does. Push notifications are deferred to a future
  native-app phase; this is email-only.
- **Re-trigger rule**: fires only on a real off→on transition — the truck
  had no current, unexpired location immediately before this post. Posting
  again while already active (same spot or a new one down the block) never
  re-fires. `extendLocation` is a separate code path entirely and was
  already built for "still here, don't re-notify."
- **Known accepted gap**: a truck that goes active → expires → goes active
  again later the same day re-notifies each time — that's what "off→on
  transition" means by construction. No additional per-day cooldown was
  requested or built. Revisit if this feels spammy in practice.

## How it works

`postLocation` (`apps/web/lib/locations.ts`) checks, **inside the same
`$transaction`** as the write (not before it, so the check can't race the
write it's gating — same rigor `extendLocation`'s WHERE clause already
applies), whether an active current location existed for the truck. If not,
it's an activation: after the transaction commits, `postLocation` sends an
`app/truck.activated` Inngest event (fire-and-forget, `truckId` only).

`notifyFavoritesOnActivationFunction` (`apps/web/inngest/functions.ts`,
same handler/function split as `eraseUserHandler`/`eraseUserFunction` for
direct unit testability) picks that up:
1. Loads the truck's name/slug (`getTruckNameAndSlug`) — no-ops if the
   truck was deleted between the event firing and this running.
2. Loads opted-in favoriter emails (`getOptedInFavoriterEmails`,
   `apps/web/lib/favorite-notifications.ts`) — resolved fresh from the DB
   at send time, not carried on the event, so a favorite/opt-out change in
   between is naturally respected.
3. Sends one email per recipient via `sendEmail`
   (`apps/web/lib/email.ts`), individually — never cc/bcc, so one
   favoriter's email is never exposed to another. Uses `Promise.allSettled`,
   not `Promise.all`: one recipient's failed send doesn't fail the whole
   Inngest run (which would otherwise retry and re-email everyone who
   already got it). No per-recipient retry beyond that — a v1 scope cut.

Registered in `apps/web/app/api/inngest/route.ts` alongside the existing
functions.

## Security

- Recipient emails come entirely from `User.email` (Clerk-synced),
  resolved server-side — never from client input, satisfying the standing
  note in `/docs/features/email.md`.
- `updateNotificationPreferenceAction` (`apps/web/app/actions/account.ts`)
  takes no target-user parameter — it can only ever update the caller's own
  row, same IDOR-free pattern as `deleteOwnAccountAction`.

## Testing

- `apps/web/lib/locations.test.ts` — `postLocation`'s activation-detection
  branch: fires on a true off→on transition, does not fire when already
  active, and confirms the check runs against the transaction client (can't
  race the write).
- `apps/web/lib/favorite-notifications.test.ts` — the two DB helpers and
  the email HTML builder, Prisma mocked.
- `apps/web/inngest/functions.test.ts` — `notifyFavoritesOnActivationHandler`
  with a stubbed `step`: no-ops on a deleted truck or zero opted-in
  favoriters, sends one email per recipient, one failed send doesn't stop
  the others.
- `apps/web/app/actions/account.test.ts` — `updateNotificationPreferenceAction`
  only ever touches the caller's own row.

No e2e test yet — would need a live Inngest Dev Server run + seeded
favorites + a real opted-in user, same prerequisite gap as this app's other
Clerk/Inngest-dependent flows.

## Migration

`20260816225240_add_notify_favorite_active` — adds
`users.notify_favorite_active BOOLEAN NOT NULL DEFAULT false`, no backfill.
Applied to the Neon dev DB 2026-08-16.
