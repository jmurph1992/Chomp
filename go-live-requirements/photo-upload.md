# Photo Upload — go-live requirements

- **R2 lifecycle rule not yet configured.** A client that requests an upload
  slot, uploads to R2, and never calls the finalize action leaves an orphaned
  object with no app-level code path that ever cleans it up. Needs an R2
  bucket lifecycle rule (Cloudflare dashboard) auto-expiring objects older
  than ~24h. Documented in `.env.example` and `/docs/features/photo-upload.md`,
  but not actually configured anywhere yet.
- **No rate limiting on upload-slot requests.** Any signed-in user can call
  `requestUploadSlotAction` repeatedly — same category of gap as truck
  creation and review submission (see the other `go-live-requirements` files).
  Here it's slightly more expensive than those: each successful ingest is a
  billed Cloudflare Images resource, not just a DB write.
