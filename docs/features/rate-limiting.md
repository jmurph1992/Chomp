# Rate Limiting

Three signed-in-only write actions had no protection against a single user
hammering them: review submission, truck creation, and upload-slot requests
(the last one is the most expensive — each successful slot request can lead
to a billed Cloudflare Images ingest, not just a DB write). All three now go
through one shared primitive.

## `apps/web/lib/rate-limit.ts`

- Redis client: `Redis.fromEnv()` (`@upstash/redis`), reading
  `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` from the environment —
  an Upstash serverless Redis database, chosen because it's REST-based (no
  connection pooling to manage from Vercel's serverless functions, unlike a
  traditional Redis client).
- Three `Ratelimit` instances (`@upstash/ratelimit`), each a sliding window
  sized to that action's actual abuse/cost profile:
  - `reviewLimiter` — 5 per hour. Reviews are cheap and already upsert-keyed
    on `(truckId, userId)` so repeated submissions can't create duplicate
    rows, but nothing stopped hammering the write path itself.
  - `truckCreationLimiter` — 3 per day. A legitimate operator creates a
    truck rarely; this mainly guards against spam-creating trucks.
  - `uploadSlotLimiter` — 20 per hour. Tighter relative to its normal-use
    ceiling than the others because each successful slot request can end in
    a billed Cloudflare Images resource.
- `checkRateLimit(limiter, userId)` — throws (rather than returning a
  boolean) on the limit being exceeded, so it plugs into the same
  throw-on-reject pattern the auth checks already use (see
  `requireOperator` in `docs/features/operator-dashboard.md`) and surfaces
  through the same client-side try/catch → error-message UI path.

## Call sites

Each of `submitReviewAction`, `createTruckAction`, and
`requestUploadSlotAction` calls `checkRateLimit` immediately after resolving
the acting user from the Clerk session, before any DB or Cloudflare write —
same placement as the existing auth checks in those actions. Keyed by Clerk
`userId`, not IP: all three actions already require sign-in, so there's no
need to parse `x-forwarded-for`/proxy headers for a v1.

`finalizeUploadAction` (the action that actually performs the billed
Cloudflare Images ingest) is deliberately *not* separately rate limited —
`requestUploadSlotAction` gates the step before it, and a client can't reach
`finalizeUploadAction` with a key it was never issued a slot for.

## Why Upstash over an in-memory or DB-backed limiter

- **In-memory** (e.g. a plain `Map` counter) doesn't work on Vercel —
  serverless function instances don't share memory across invocations, so
  it would silently do nothing in production.
- **DB-backed** (a Postgres counter table) would work but adds write load to
  the exact path being protected from write-load abuse.
- Upstash was already the documented stack choice for caching
  (`docs/architecture/stack.md`) — this pulls that forward rather than
  adding a one-off dependency.

## Testing

`lib/rate-limit.test.ts` mocks `@upstash/redis`/`@upstash/ratelimit` and
asserts `checkRateLimit` resolves on an allowed request, throws a clear
message on a denied one, and keys by the given user id. Each of the three
action test files mocks `@/lib/rate-limit` and adds a
"rejects when rate limited, without touching the database/Cloudflare" case,
matching the existing sign-out-rejection test shape in those files.

Verified end-to-end against the real Upstash database once credentials were
added: a throwaway script hit the real REST API with a 2-per-window limiter,
confirmed the 3rd call was denied, then cleaned up its test key.
