# Chomp — Session Handoff

> This file is updated at the end of every Claude session.
> It contains everything needed to resume work immediately.

---

## Last Updated
2026-05-06

## Current Phase
**Monorepo scaffolded** — structure, config, and base files in place. Next: Neon DB + Clerk setup.

## What Was Decided This Session

### Product
- Food truck tracking app for both operators and customers
- National scale target
- Location updates every ~30 minutes (trucks are mostly stationary during service)
- Operators: manage truck profile, GPS/manual location, weekly schedule, menu, events
- Customers: discover trucks, leave reviews, upload food photos
- Public feed: recent high-rated reviews + popular photos

### Tech Stack (finalized)
- Next.js 15 (App Router) + TypeScript strict
- Tailwind CSS + shadcn/ui
- PostgreSQL + PostGIS on **Neon** (operator has existing account)
- ORM: **TBD — Prisma vs Drizzle** (open decision, see below)
- Redis for location/feed caching
- Inngest for background jobs
- Clerk (auth), Resend (email), Mapbox (maps), Cloudflare R2 (storage), Stripe (payments, future), Sentry (monitoring)
- Mobile: React Native + Expo (future phase)

### Database Schema
Fully designed. See `/docs/architecture/schema.md`.
Domains: users, trucks, truck_operators, truck_locations, truck_schedules, menu_categories, menu_items, reviews, review_photos, photo_likes, feed_items (materialized view), truck_events.

### Project Structure Created
- `CLAUDE.md` — AI guidelines
- `HANDOFF.md` — this file
- `docs/README.md` — documentation table of contents
- `docs/architecture/stack.md` — tech stack decisions
- `docs/architecture/schema.md` — full DB schema
- `future-plans/` — empty, for future feature ideas
- `known-issues/` — empty, for tracked bugs outside tickets
- `go-live-requirements/` — empty, for pre-launch checklist

## Open Decisions
All resolved. None outstanding.

## Next Steps (in order)
1. Connect Neon DB — add `DATABASE_URL` + `DIRECT_URL` to `.env.local`, run `prisma generate` from `packages/db`, then run first migration
2. Set up Clerk — install `@clerk/nextjs`, wrap layout in `<ClerkProvider>`, add middleware, create webhook to sync users to DB
3. Begin feature development (map view is the core customer experience — start there)

## Key Files to Review
- `/docs/README.md` — start here for orientation
- `/docs/architecture/stack.md`
- `/docs/architecture/schema.md`
- `/CLAUDE.md` — rules for AI behavior on this project
