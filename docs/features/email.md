# Email (Resend)

## Status: plumbing only

Built as a standalone prerequisite for two roadmap items that were
otherwise blocked on there being zero email infrastructure in the app:
favorites × "Active now" notifications (`future-plans/roadmap.md` item 7d)
and operator notification on verification decisions (item 7h). Neither
consumer is built yet — this is just the verified foundation they'll both
call into.

## What's here

`apps/web/lib/email.ts` — a single `sendEmail({ to, subject, html })`,
modeled on `lib/storage.ts`'s lazily-constructed-client pattern (a
`resendClient()` getter, no client held at module scope). No templating
system, no queue, no retry logic — deliberately minimal until a real
consumer defines what it actually needs.

`RESEND_API_KEY` (server-only secret, no `NEXT_PUBLIC_` prefix) and
`RESEND_FROM_EMAIL` are both in `.env.example`. `RESEND_FROM_EMAIL`
defaults to Resend's shared test sender (`onboarding@resend.dev`) — works
with zero DNS setup, but swap to a verified Chomp domain before any real
product email ships; the test sender is fine for confirming the plumbing
works, not for real users.

## Security

- `to` is always caller-supplied with no validation in `sendEmail` itself —
  intentional, since this has no callers yet to define the right check.
  **Whoever builds the first real consumer (d or h above) must source `to`
  from the authenticated user's own verified email via Clerk, never from
  client input.**
- The API key is read via `process.env` only, server-side — same handling
  as the `CLOUDFLARE_*` secrets in `lib/storage.ts`.

## Testing

`apps/web/lib/email.test.ts` — mocks the `resend` package (same style as
`lib/storage.test.ts` mocks `@aws-sdk/client-s3`), asserts the right
payload is sent and that a Resend-returned `error` becomes a thrown `Error`.

No real send is exercised by the automated test suite. **Manually verified
end-to-end 2026-08-16**: a scoped "Sending access only," no-domain-restricted
API key was created for this project, dropped into `apps/web/.env.local`,
and a one-time throwaway script (not committed) confirmed Resend accepted a
real send.

**Constraint discovered during that verification**: Resend's shared test
domain (`onboarding@resend.dev`) will only deliver to the email address the
Resend *account itself* is registered under — not to arbitrary recipients.
So until a real Chomp domain is verified in Resend, `sendEmail` can only
actually reach that one address in practice, regardless of what `to` is
passed. This matters for whoever builds item 7d/7h next: local/manual
testing against this plumbing needs either the account-owner address as the
recipient, or a verified domain swapped into `RESEND_FROM_EMAIL` first.
