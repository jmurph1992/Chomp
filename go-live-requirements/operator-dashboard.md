# Operator Dashboard — go-live requirements

- ~~No rate limiting on truck creation~~ — **done**, see
  `/docs/features/rate-limiting.md`. `createTruckAction` is limited to 3/day
  per user via Upstash Redis.
- ~~No way to prevent fake truck accounts~~ — **done 2026-08-04**, see
  `/docs/features/truck-verification.md`. New trucks are hidden from the map
  and their public page until an admin verifies them via `/admin/trucks`;
  an admin can also pull a previously verified truck back off the map
  ("on hold") if it turns out to be fraudulent later. This is a *visibility*
  lever, not a deletion one — see the next item, still open.
- ~~No manager-invite flow~~ — **done 2026-08-07**, see
  `/docs/features/manager-invites.md`. An owner can invite a manager by
  shareable, email-gated link; cancel a pending invite; or remove an existing
  manager.
- ~~No way to transfer ownership~~ — **done 2026-08-10**, see
  `/docs/features/operator-dashboard.md#ownership-transfer`. An owner can
  offer ownership to an existing manager, who must explicitly accept before
  anything changes.
- ~~No way to delete a truck~~ — **done 2026-08-10**, see
  `/docs/features/operator-dashboard.md#truck-deletion`. Owner-only, type-the-
  name-to-confirm; reviews/photos are orphaned (kept, detached) rather than
  deleted, everything else truck-owned cascades.
- ~~Image upload~~ — **done**, see `/docs/features/photo-upload.md`. Logo,
  cover, and menu-item photos all go through the R2 + Cloudflare Images
  hybrid upload flow.
