# Auth — go-live requirements

- **Account deletion / erasure handling.** `user.deleted` Clerk webhooks are currently
  logged and no-op'd (see `/docs/features/auth.md#known-gap-account-deletion`). Before
  launch we need a real decision on what happens to a deleted user's trucks, reviews,
  and photos — hard delete, anonymize, or soft-delete-and-hide — and the schema/webhook
  changes to implement it. Matters for GDPR/CCPA-style "delete my account" requests at
  national scale.
