# Operator Dashboard — go-live requirements

- **No rate limiting on truck creation.** Any signed-in user can call
  `createTruckAction` repeatedly — nothing stops someone from spam-creating
  trucks. Same category of gap as review-submission rate limiting
  (`/go-live-requirements/reviews.md`).
- **No manager-invite flow.** `TruckOperator(role: manager)` is fully
  functional (full permission parity with owner) but nothing in the product
  creates that row — an owner can't add a manager. Needs its own UI before
  "manager" is a real feature rather than a schema capability.
- **No way to delete a truck** or transfer ownership. Deactivating
  (`isActive: false`) is the only operator-facing way to take a truck down.
- **Image upload.** Logo, cover, and menu-item photos are all pasted-URL only,
  same gap as `/go-live-requirements` items for menu/reviews — all blocked on
  Cloudflare R2/Images.
