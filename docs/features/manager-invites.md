# Manager Invites

Lets a truck's owner add a manager. `TruckOperator(role: manager)` has had
full permission parity with `owner` since the operator dashboard shipped, but
nothing created that row until this pass — `/dashboard/[truckId]/team` is the
first product-facing path.

## Why link-only, not email

Resend is documented as this app's eventual email provider but deliberately
never wired up — the standing plan is to stand it up at its own natural
trigger (first real transactional email need), not proactively for one
feature. So invites are a **shareable link only**: the owner generates it and
sends it themselves (text, Slack, whatever) — no email is ever sent by the
app. One consequence worth being explicit about: since nothing is emailed,
there's no header-injection/spoofing/open-relay surface to worry about for
this feature at all, not because it was mitigated but because the delivery
mechanism that would create it doesn't exist here.

## The security boundary is the email match, not the link itself

A link can leak (forwarded, screenshotted, pasted somewhere public). What
actually gates access is `lib/invites.ts#claimInvite` comparing the invite's
stored `invitedEmail` against the Clerk-authenticated claimant's own email —
never a client-supplied field. Holding the link alone isn't sufficient; the
claimant must sign in or sign up with the exact email the owner invited.

The token itself (`randomUUID()`, 122 bits of entropy, `node:crypto` — the
same generation approach already used for R2 upload keys in `lib/storage.ts`,
no new JWT/HMAC pattern introduced) is still worth protecting from casual
exposure: `getInvitePreview`, the unauthenticated-safe read used by the claim
landing page, returns only the truck's name, status, and expiry — never
`invitedEmail` — so a leaked link can't be used to find out who was invited.

## Owner-only, not manager-invitable

Only the truck's `owner` can send an invite, cancel a pending one, or remove
an existing manager — a manager visiting `/dashboard/[truckId]/team` sees the
lists read-only. This is a new guard shape (`app/actions/invites.ts`):

```ts
const { user, role } = await requireOperator(truckId)
if (role !== 'owner') throw new Error('Only the truck owner can do this')
```

`requireOperator` alone only proves the caller manages *some* truck with that
id — it doesn't distinguish owner from manager. This is the first place in
the app that needed to make that distinction.

## Lifecycle

- **Create** (`createInvite`): reuses an existing live `pending` invite for
  the same `(truckId, email)` instead of minting a duplicate link if the
  owner re-clicks invite for the same person. A stale pending invite past its
  `expiresAt` is flipped to `expired` and replaced. Rejects if the email
  already belongs to a current operator of the truck. `expiresAt` (7 days
  out) is always computed server-side.
- **Claim** (`claimInvite`): pre-checks (not found, wrong status, expired,
  email mismatch) run as plain reads/single writes; only the actual grant —
  creating the `TruckOperator` row, upgrading `User.role` from `customer` to
  `operator` if applicable, and marking the invite `accepted` — is wrapped in
  `db.$transaction`, so a crash partway through can't leave any of the three
  out of sync with the others. Already being an operator on claim is treated
  as idempotent success, not an error. `role: 'manager'` is always hardcoded
  on the created `TruckOperator` row — never derived from any input, so
  there's no path to self-grant `owner` through this flow. The `User.role`
  upgrade is the third legitimate writer of that field (alongside the Clerk
  webhook and `lib/trucks.ts#createTruck`) and, like `createTruck`, never
  downgrades an existing `operator`/`admin`.
- **Cancel** (`cancelInvite`): owner-only, only affects a still-`pending`
  invite, scoped by both `id` and `truckId` (`updateMany` + `count === 1`
  check) — the same IDOR-prevention idiom already used in `lib/menu.ts`/
  `lib/schedule.ts` for cross-truck protection.
- **Remove a manager** (`removeManager`): the first removal path for
  `TruckOperator` rows at all — previously Prisma Studio was the only way. An
  owner can never remove themselves through this function (explicit check;
  use ownership transfer to step back instead — see
  `/docs/features/operator-dashboard.md#ownership-transfer`), and the delete
  itself is scoped to `role: 'manager'` as a second, belt-and-suspenders
  layer even if that check were ever bypassed. Also clears any pending
  ownership-transfer offer naming the removed manager, in the same
  transaction as the delete.

## Expiry is lazy, not swept

`expired` is only ever written when something actually looks at a stale
`pending` row (a claim attempt, or the claim landing page's own timestamp
check) — there's no scheduled job sweeping for expired invites. This app
already has exactly one scheduled job (the feed's daily refresh via Inngest,
see `/docs/features/feed.md`) and this doesn't need one; a low-traffic status
flip on next access is enough.

## Redirect flow for a not-yet-signed-in invitee

`/invite/[token]` is public (added to `middleware.ts`'s allowlist) so an
unauthenticated visitor can see what they're accepting before being pushed
into auth — the claim action itself still independently requires a session.
Signed out, the page links to `/sign-up?redirect_url=/invite/{token}` and
`/sign-in?redirect_url=/invite/{token}`; both auth pages now read that param
and pass it to Clerk's `fallbackRedirectUrl` (first use of post-auth redirect
wiring in this app).

`redirect_url` is sanitized (`lib/redirect.ts#safeRedirectPath`) before ever
reaching Clerk — only a same-origin relative path is accepted, rejecting
absolute and protocol-relative (`//evil.com`) URLs, so a crafted query param
can't turn this into an open redirect.

No email prefill on the sign-up form: `getInvitePreview` deliberately
withholds `invitedEmail` from unauthenticated viewers, and prefilling would
require passing it through a query param instead, undercutting that. The
invitee retypes their email — a minor UX cost for not exposing who-was-invited
to anyone who merely holds the link.

Accepting requires an explicit click (`components/invite-claim-button.tsx`),
not an auto-fire on page load — a stale or forwarded link shouldn't silently
enroll a signed-in visitor who merely landed on the page.

## Rate limiting

`inviteLimiter` (`lib/rate-limit.ts`, 10/hour per owner) applies only to
invite creation — an owner could otherwise spam-generate links (the
create-time dedup helps but doesn't fully replace a rate limit, since many
*different* invitees in a burst is still legitimate but unbounded). Cancel,
remove, and claim aren't separately limited — claim is already gated by
needing a valid, unexpired token in the first place, same reasoning already
documented for why `finalizeUploadAction` isn't separately limited in
`/docs/features/rate-limiting.md`.

## Scope cuts

- No email delivery at all (see above) — copy/share is manual.
- No distinct "resend" action — re-inviting the same email reuses the
  existing live link rather than minting a new one.
- No bulk invite (one email at a time).
- ~~No ownership transfer~~ **Resolved**: an owner can offer ownership to an
  existing manager, who must explicitly accept before anything changes — see
  `/docs/features/operator-dashboard.md#ownership-transfer`.
- No configurable expiry window — fixed at 7 days.

## Testing

- `lib/invites.test.ts`: create (dedup-reuse, stale-replace, existing-operator
  rejection, invalid email, 7-day expiry math), list functions, cancel (happy
  path, cross-truck IDOR, already-resolved), claim (happy path, not-found,
  expired including the lazy status-flip write, cancelled, already-accepted,
  email-mismatch including case-insensitivity, already-a-member idempotency),
  removeManager (happy path, owner-cannot-remove-self, cross-truck IDOR,
  owner-row protected even if the self-check were bypassed).
- `app/actions/invites.test.ts`: each owner-gated action tested against a
  non-operator, a manager (rejected by the new role check specifically), and
  an owner (success + `revalidatePath`); `createInviteAction` additionally
  tests rate-limit rejection short-circuiting; `claimInviteAction` tested
  signed-out (rejected) and signed-in (delegates, propagates lib errors
  unchanged).
- `lib/redirect.test.ts`: same-origin path accepted; absolute and
  protocol-relative URLs rejected.
- `e2e/invite.spec.ts`: confirms a signed-out visitor can load `/invite/[token]`
  without being bounced to sign-in (proves the middleware allowlist change).
  A full create→claim round trip needs two distinct authenticated Clerk
  identities, a gap already acknowledged elsewhere (review submission, truck
  creation) for the same reason.
