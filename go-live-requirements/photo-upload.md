# Photo Upload — go-live requirements

- **R2 lifecycle rule not yet configured.** A client that requests an upload
  slot, uploads to R2, and never calls the finalize action leaves an orphaned
  object with no app-level code path that ever cleans it up. Needs an R2
  bucket lifecycle rule (Cloudflare dashboard) auto-expiring objects older
  than ~24h. Documented in `.env.example` and `/docs/features/photo-upload.md`,
  but not actually configured anywhere yet.
- ~~No rate limiting on upload-slot requests~~ — **done**, see
  `/docs/features/rate-limiting.md`. `requestUploadSlotAction` is limited to
  20/hour per user via Upstash Redis — tighter relative to normal use than
  the other two limits, since each successful slot request can end in a
  billed Cloudflare Images ingest.
