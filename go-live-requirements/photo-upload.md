# Photo Upload — go-live requirements

- ~~R2 lifecycle rule not yet configured~~ — **done 2026-08-07**. `chomp-uploads`
  has an `expire-orphaned-uploads` rule (prefix `uploads/`, delete after 1
  day, enabled) configured in the Cloudflare dashboard, covering a client
  that requests an upload slot, uploads to R2, and never calls finalize. See
  `/docs/features/photo-upload.md`'s Setup checklist.
- ~~No rate limiting on upload-slot requests~~ — **done**, see
  `/docs/features/rate-limiting.md`. `requestUploadSlotAction` is limited to
  20/hour per user via Upstash Redis — tighter relative to normal use than
  the other two limits, since each successful slot request can end in a
  billed Cloudflare Images ingest.
