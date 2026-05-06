# Chomp — Session Handoff

> This file is updated at the end of every Claude session.
> It contains everything needed to resume work immediately.

---

## Last Updated
2026-05-06

## Current Phase
**Pre-development planning** — no code written yet.

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

## Open Decisions (need answer before coding starts)
1. **ORM**: Prisma or Drizzle? Drizzle recommended due to PostGIS usage — Prisma requires raw SQL for geospatial queries.
2. **pnpm workspaces**: Assumed for monorepo — confirm before scaffolding.
3. **Auth provider**: Clerk confirmed.

## Next Steps (in order)
1. Resolve open decisions above
2. Scaffold monorepo structure (`/apps/web`, `/packages/db`, `/packages/types`, `/packages/utils`)
3. Set up Neon DB + PostGIS + run initial schema migration
4. Set up Clerk auth + user sync to DB
5. Begin feature development (map view likely first — it's the core customer experience)

## Key Files to Review
- `/docs/README.md` — start here for orientation
- `/docs/architecture/stack.md`
- `/docs/architecture/schema.md`
- `/CLAUDE.md` — rules for AI behavior on this project
