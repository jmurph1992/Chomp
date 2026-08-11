# Account Erasure

Handles a "delete my account" request (self-service, or admin-initiated) in a
way that satisfies GDPR/CCPA-style erasure without destroying content other
users rely on. Closes the one item that had been deliberately left open on
the roadmap since the account page shipped — see `future-plans/roadmap.md`.

## Three decisions, locked in before building

1. **Reviews/review photos are anonymized, not deleted.** Content (rating,
   body, photo) stays fully visible; attribution becomes "Deleted user."
   Mirrors the existing orphaned-review pattern from truck deletion (see
   `/docs/features/operator-dashboard.md#truck-deletion`) — the same
   "content survives, identity doesn't" shape, just triggered by the *user*
   disappearing instead of the *truck*.
2. **The `User` row is hard-deleted**, not soft-deleted-and-scrubbed. A
   retained, PII-nulled row would depend on every current *and future*
   PII-bearing column on `User` being remembered in the scrub path forever;
   an actually-deleted row can't leak a column that doesn't exist yet.
   Extends the truck-deletion orphaning pattern symmetrically instead of
   introducing a second mechanism.
3. **A user who's the sole owner of a truck is never auto-resolved** — no
   silently promoting a manager to owner. That would violate the explicit
   consent requirement already established for voluntary ownership transfer
   (`/docs/features/operator-dashboard.md#ownership-transfer`): ownership
   carries real responsibility and isn't handed out as a side effect of
   someone else's account being deleted.

## Schema

`packages/db/prisma/schema.prisma`, migration `20260811211442_account_erasure`:

- `Review.userId` / `ReviewPhoto.userId` → nullable, `onDelete: SetNull`
  (mirrors `truckId` exactly).
- `TruckOperator.userId` / `PhotoLike.userId` → `onDelete: Cascade` (purely
  personal, no third-party interest — same bucket as `TruckFavorite`/
  `MenuItemFavorite`, which already cascaded on `userId` from the favorites
  session, pre-wired for exactly this).
- `TruckInvite.createdByUserId` → nullable, `onDelete: SetNull` (was already
  nullable with no `onDelete` written — Prisma's implicit default for an
  optional relation is already `SetNull`, confirmed by generating the
  migration off an explicit annotation and getting no DDL change; same true
  of `Review.moderatedByUserId` and `TruckInvite.acceptedByUserId`, both made
  explicit in the schema without changing behavior).
- **`Truck.ownerId` deliberately untouched — still required, still
  `RESTRICT`.** This is the actual safety net: Postgres itself refuses to
  delete a user who still owns a truck, no matter what application code does
  or forgets to do. Everything below exists to give a good UX and a
  moderation queue *before* ever hitting that wall, not to replace it.
- New `ModerationQueueEntry` — a **generic** admin queue (reason enum,
  status, snapshot fields, resolution audit trail), not hardcoded to this one
  trigger. `blockingTruckIds` is a snapshot only, never trusted as
  still-accurate — every read that matters re-derives the live blocking set.
- New `ErasureRecord` — the only thing that survives a completed erasure:
  `sha256(lowercased email)`, a `trigger` (`direct` or
  `resolvedFromModerationQueue`), and a timestamp. Proves a specific request
  was honored without retaining the PII that made it identifiable. `trigger`
  is classified from durable DB state (was there a resolved
  `ModerationQueueEntry` for this subject) at erasure time, not from which
  caller's event happened to arrive first — self-service deletion, an
  admin's non-blocked deletion, and the webhook's own send can all fire
  near-simultaneously, so tagging the event itself would be racy.

## The erasure job

`apps/web/lib/clerk-webhook.ts`'s `user.deleted` case hands off to
`inngest.send({ name: 'app/user.deleted', data: { clerkId } })` rather than
erasing inline — the first event-triggered Inngest function in this codebase
(the feed refresh is cron-only). `apps/web/inngest/functions.ts#eraseUserHandler`:

1. Resolve the DB user by `clerkId` (`lib/user-erasure.ts#findUserByClerkId`)
   — no-op if not found (already erased, or the webhook raced ahead of the
   initial `user.created` sync).
2. `findSoleOwnedTrucks(userId)` — if non-empty: `deactivateTrucks` (same
   `isActive` field truck verification already uses to pull a truck off the
   map), `openErasureBlockedEntry` (idempotent — a re-delivered webhook or a
   resent event doesn't spam the queue), and **stop**. Erasure is held, not
   completed.
3. Otherwise: `removeAllPhotoLikesForUser(userId)` — must run *before*
   `eraseUserRow`, not left to a raw DB cascade. `PhotoLike.userId` cascades
   on delete, but a raw cascade removes the rows without ever touching
   `ReviewPhoto.likesCount` (a denormalized counter), silently desyncing it.
   This mirrors `unlikePhoto`'s per-row decrement, batched.
4. `eraseUserRow(user)` — one `db.$transaction`: delete the `User` row
   (every other cascade/SetNull above fires automatically) + create the
   `ErasureRecord`. Idempotent — swallows Prisma P2025 (already gone) as a
   retried/duplicate event, not an error.

## The moderation queue

`apps/web/lib/moderation-queue.ts`. Two ways in, one queue:

- **An admin deletes a user through Chomp's own `/admin/users`** (there is no
  in-app admin user-management surface before this feature — new territory).
  `deleteUserAction` pre-checks `findSoleOwnedTrucks` *before* ever calling
  Clerk — if blocked, `banClerkUser` (reversible, unlike deletion) instead of
  `deleteClerkUser`.
- **The `user.deleted` webhook fires anyway** — self-serve deletion, a race,
  or an admin deleting a user *directly in Clerk's dashboard* (which bypasses
  the pre-check entirely; Clerk offers no pre-delete veto, only the
  after-the-fact webhook, and by the time it arrives the account is already
  gone, irreversibly — no in-app code can close that specific gap, only
  process: restrict who has direct Clerk dashboard access).

Both land in the same `ModerationQueueEntry`. Two resolutions:

- **`resolveModerationEntry`** — re-verifies `findSoleOwnedTrucks` live
  (never trusts the entry's stored snapshot), throws if still blocked. On
  success: marks `resolved`, attempts `deleteClerkUser` (handles the
  banned-not-deleted case; a 404 means it was already deleted directly,
  swallowed rather than treated as failure), and **always** also sends the
  erasure event directly — belt-and-suspenders, safe because the handler is
  idempotent, and the only reliable way to complete DB erasure when Clerk
  won't re-fire a webhook for an account that's already gone.
- **`dismissModerationEntry`** — the opposite: reactivates the trucks,
  unbans the Clerk account, marks `dismissed`. No erasure is ever triggered
  for that subject. For when the underlying request turns out to have been
  mistaken or fraudulent and the account should be restored instead.

A blocked/held truck can't be resolved through the *normal* transfer/delete
flows — both `initiateOwnershipTransfer` and `deleteTruckAction` require the
current owner's own live session, and that owner is exactly who's locked out.
Two admin-only escape hatches close this: `adminDeleteTruckAction` (thin
`requireAdmin` wrapper around the unchanged `deleteTruck`) and
`adminReassignTruckOwner` (`lib/invites.ts` — mirrors
`acceptOwnershipTransfer`'s transaction but skips the offer/accept dance,
since the outgoing owner can't participate to consent; still requires the
target to already be an existing manager).

## Self-serve deletion

`/account`'s embedded Clerk `<UserProfile />` has its own built-in
delete-account button with no per-component way to hide just that section —
Clerk's customization API is for *adding* pages, not removing stock ones.
The correct lever is Clerk's own instance-level "allow users to delete their
account" toggle (Clerk Dashboard → User & authentication → User model →
User permissions) — **turned off 2026-08-11**, confirmed directly in the
Clerk Dashboard, so `DeleteAccountSection` below is now the only in-app path
to delete an account. Note this only closes the self-serve UI path — an
admin deleting a user directly from the Clerk Dashboard's own Users page is
a separate action this toggle doesn't affect, which is exactly why the
erasure job's sole-ownership check still holds/queues defensively regardless
of which path triggered the webhook (see "The moderation queue" above).

`components/account/delete-account-section.tsx` mirrors
`delete-truck-section.tsx`'s type-to-confirm pattern, confirming the user's
**email** instead of a truck name — the one thing every user unambiguously
knows. If `findSoleOwnedTrucks` (resolved server-side, before render) is
non-empty, the confirm input never renders at all — links to the relevant
transfer/delete-truck flows show instead.

`deleteOwnAccountAction` never accepts a target `userId` — it operates only
on `getCurrentUser()`'s own id, which eliminates the IDOR surface by
construction rather than needing the scoped-`updateMany` idiom every other
mutation in this app uses.

## Security

- Every new admin action independently calls `requireAdmin()`; the self-serve
  action can't be pointed at anyone but the caller.
- `deleteUserAction` rejects a target with `role: 'admin'` — admin accounts
  aren't self-service anywhere else in this app (role is only ever set via
  direct DB access), removal should follow the same out-of-band path.
- No rate limiting on either delete action, deliberately — both are terminal
  on success (no account left to retry with) and cheap on failure (a
  read-only check). Matches `deleteTruckAction`'s precedent, this app's one
  other truly-destructive action, which also has no limiter.
- `CLERK_SECRET_KEY` now grants destructive Backend API operations
  (ban/unban/delete any user) via the new `lib/clerk-admin.ts` — the only
  file in the app that touches `@clerk/nextjs/server`'s `clerkClient()`
  directly, same "abstracted behind a boundary" rule already applied to
  `getCurrentUser()`. Flagged in `.env.example`.

## Testing

- `lib/user-erasure.test.ts`, `lib/moderation-queue.test.ts`,
  `lib/clerk-admin.test.ts` (new); `lib/review-photos.test.ts`,
  `lib/reviews.test.ts`, `lib/feed.test.ts`, `lib/clerk-webhook.test.ts`,
  `lib/invites.test.ts`, `inngest/functions.test.ts` (extended);
  `app/actions/admin-users.test.ts`, `app/actions/account.test.ts` (new).
- Real-DB verification (throwaway script, same pattern as prior
  cascade-verification sessions, deleted after use): a user with reviews,
  likes, a manager role, and a sent invite but no owned truck — erased,
  confirmed `Review`/`ReviewPhoto` survive with `userId NULL` and
  `likesCount` still correct, `TruckOperator`/`PhotoLike` gone,
  `TruckInvite.createdByUserId` `NULL`, `User` row gone, `ErasureRecord`
  written with `trigger: 'direct'`. A second user who owns a truck — blocked,
  confirmed the truck deactivates and a `ModerationQueueEntry` opens
  (idempotently, a duplicate call doesn't create a second one), resolved via
  `adminReassignTruckOwner` + a direct erasure re-run, confirmed it completes
  with `trigger: 'resolvedFromModerationQueue'` referencing the entry.
- **Not verified**: a full signed-in click-through of the self-serve delete
  flow and the admin block/resolve/dismiss UI — no Chrome browser session was
  available in this environment, same gap already flagged for every other
  Clerk-dependent interactive flow in this project's history. Also not
  exercised for real: the actual Clerk Backend API calls
  (`banClerkUser`/`unbanClerkUser`/`deleteClerkUser`) — covered by mocked
  unit tests only, not against a real Clerk test account.
