# Auth — go-live requirements

- ~~Account deletion / erasure handling~~ — **done**, see
  `/docs/features/account-erasure.md`. Reviews/photos are anonymized (kept visible,
  "Deleted user"); the `User` row is hard-deleted via an Inngest job; a user who's the
  sole owner of a truck is blocked and routed to a generic admin moderation queue
  rather than auto-resolved.
