# Truck Verification

Any signed-in user can create a truck (`/dashboard/new`), and until this pass
that truck went live on the map immediately with zero identity or
business-legitimacy check — rate limiting (see `/docs/features/rate-limiting.md`)
only throttled volume, it didn't stop someone patiently creating a handful of
fake trucks. Verification closes that gap: new trucks are hidden from
customers until an admin manually approves them.

## Status model

`Truck.verificationStatus` (`VerificationStatus` enum in `packages/db/prisma/schema.prisma`):

- **`pending`** — default on creation. Not visible to customers.
- **`verified`** — admin-approved. The only status that's ever shown on the
  map, the truck's own page, or (implicitly) able to accumulate feed items.
- **`rejected`** — admin-declined, pre-launch. `verificationNote` holds why.
- **`onHold`** — was verified, an admin pulled it back off the map (e.g. a
  fraud report or health-code complaint after the fact) without treating it
  as a fresh rejection. Also carries a `verificationNote`.

`verificationNote` is nullable, cleared automatically whenever a truck moves
back to `verified` (`lib/trucks.ts#verifyTruck`).

This replaced a plain `Truck.isVerified: Boolean` that existed since the
initial schema but was never actually wired to anything — no admin UI ever
set it, and it didn't gate visibility. See migration
`20260804140000_add_truck_verification_status` for the backfill (old
`isVerified = true` → `verified`, everything else → `pending`).

## Visibility gating

- `getTruckBySlug` (`apps/web/lib/trucks.ts`) — `where` now requires
  `verificationStatus: 'verified'` alongside the existing `isActive: true`.
  An unverified truck's page 404s exactly like an inactive one does.
- `getNearbyTrucks` (map query, raw SQL) — `AND t.verification_status = 'verified'`
  alongside `t.is_active = true`.
- `getTruckForEdit` (dashboard) stays unfiltered, same as it already is for
  `isActive` — an operator must be able to see/edit their own pending,
  rejected, or on-hold truck to fix whatever's blocking approval.
- The feed (`feed_items` materialized view) is untouched: it doesn't filter
  by `isActive` either, and since a truck's page 404s until verified, no
  reviews/photos can exist against it yet — nothing new to leak through the
  feed.

## Admin review queue

First admin-facing UI in the app (previously the only moderation surface was
an inline "Hide" button on a review, see `/docs/features/reviews.md`).

- `apps/web/lib/admin.ts#requireAdmin()` — same shape as
  `requireOperator`: resolves the session user, throws unless
  `role === 'admin'`. Called at the `/admin` layout (page-render gate) and
  independently inside every action in `apps/web/app/actions/admin.ts`.
- `/admin/trucks` (`apps/web/app/admin/trucks/page.tsx` +
  `apps/web/components/admin/truck-queue.tsx`) lists **every** truck
  regardless of status (unlike every customer-facing query above) — an admin
  needs to see `pending`/`rejected` trucks to review them and `verified`
  trucks to be able to put one on hold. Each row shows the profile fields
  already on the truck (name, description, phone, website, instagram,
  cuisine, owner email, created date) — nothing new is collected at
  creation time for review purposes.
- Three actions, each `requireAdmin()` → the corresponding
  `lib/trucks.ts` mutator → `revalidatePath` for the admin queue, the
  truck's public page, and `/`:
  - `verifyTruckAction(truckId, slug)` — any status → `verified`, clears the note.
  - `rejectTruckAction(truckId, slug, reason)` — requires a non-empty reason.
  - `holdTruckAction(truckId, slug, reason)` — requires a non-empty reason;
    only offered in the UI from `verified`.

## Operator-facing status

`TruckProfileEdit` (dashboard edit form type) carries `verificationStatus`
and `verificationNote` as **read-only** fields — `updateTruckProfile` never
accepts them as input, same "never accept this as input to an update, not
just hide it in a form" precedent already documented for the old
`isVerified` field in `/docs/features/operator-dashboard.md`.
`components/dashboard/truck-profile-form.tsx` renders a status pill above
the edit form (pending / verified / rejected + note / on hold + note).

## Customer-facing badge

The truck detail page shows a "Verified" badge next to the truck name,
unconditionally — since `getTruckBySlug` only ever returns `verified`
trucks, every truck that reaches that page already is one. No map marker or
feed-card treatment in this pass (kept intentionally small).

## Operator notification

Roadmap item 7h, built 2026-08-17. Every operator on the truck (owner and
managers alike — no `role` filter, same "manager parity" reasoning
`requireOperator` already applies everywhere else) gets an email whenever
an admin verifies, rejects, or holds their truck. Always-on, no opt-in
preference — unlike this app's other two email consumers (favorite
activation, new events, both discretionary), this is core status
information about the operator's own truck; an opt-out could mean an
operator never finds out why their truck vanished from the map.

`verifyTruck`/`rejectTruck`/`holdTruck` (`lib/trucks.ts`) each fire
`app/truck.verification-decided` (fire-and-forget, same as
`postLocation`/`createEvent`) after their write, **every time**, with no
dedup/transition check — unlike the favorite-activation off→on-only logic,
each call here is a deliberate, low-frequency admin decision that may
carry a fresh reason (e.g. a re-reject with an updated note), not a
high-frequency automatic trigger where re-notifying would be spammy.
`notifyOperatorsOnVerificationDecisionFunction` (`inngest/functions.ts`)
picks it up, same load-truck/load-recipients/`Promise.allSettled`-send
shape as the other two consumers. `lib/verification-notifications.ts`
(new) holds `getOperatorEmails` and `verificationDecisionEmailHtml` — the
`verified` email links to the public truck page (`/trucks/{slug}`); the
`rejected`/`onHold` emails link to the dashboard instead
(`/dashboard/{truckId}`), since a non-verified truck's public page 404s
(this file's own visibility-gating section above) — linking there would
be a dead link.

## Deliberately deferred

- **No re-reject-with-updated-reason UI nuance** — an admin can re-reject a
  truck that's already `rejected`, overwriting the note, but the queue
  doesn't do anything special to highlight "this was already rejected once."
- **No automated verification signal** (business license lookup, phone
  verification, etc.) — purely manual review. Doesn't scale to national
  volume on its own; flagged as a known follow-up, not built here.

## Testing

- `lib/trucks.test.ts` — visibility filters (`getTruckBySlug`,
  `getNearbyTrucks` both exclude non-verified trucks), `getTruckForEdit`
  returns the status fields, `getAllTrucksForAdmin` returns every truck with
  owner email, `verifyTruck`/`rejectTruck`/`holdTruck` set the right
  fields, `rejectTruck`/`holdTruck` reject an empty reason without writing
  or notifying, and each fires `app/truck.verification-decided` with the
  right decision/note.
- `lib/verification-notifications.test.ts` — `getOperatorEmails`'s
  unfiltered (owner + manager) query shape, `verificationDecisionEmailHtml`'s
  three copy/link variants.
- `inngest/functions.test.ts` —
  `notifyOperatorsOnVerificationDecisionHandler`: no-ops on a deleted
  truck or zero operators, sends one email per operator, one failed send
  doesn't stop the others.
- `lib/admin.test.ts` — `requireAdmin` rejects signed-out and non-admin
  callers, resolves for an admin.
- `app/actions/admin.test.ts` — each of the three actions rejects a
  non-admin without calling its `lib/trucks.ts` mutator.
