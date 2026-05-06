# Tech Stack

## Overview
Chomp is a Next.js monorepo targeting web first, with native mobile apps planned for a later phase.

## Repository Structure
```
/apps
  /web          # Next.js 15 app (App Router)
  /mobile       # React Native + Expo (future)
/packages
  /db           # ORM schema, migrations, seed scripts
  /types        # Shared TypeScript types
  /utils        # Shared utility functions
/docs           # This documentation library
/future-plans   # Planned features not yet scoped
/known-issues   # Tracked bugs and issues outside normal tickets
/go-live-requirements  # Checklist of requirements before public launch
```

## Services & Tooling

| Category | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR for SEO on truck/menu pages; API routes; Vercel-ready |
| Language | TypeScript (strict) | Type safety across the full stack |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent UI |
| Database | PostgreSQL 18 + PostGIS on Neon | Geospatial queries; serverless Postgres; existing account |
| ORM | Prisma | Great DX + migrations; raw SQL via `$queryRaw` for PostGIS queries only |
| Cache | Redis | 30-min location snapshots; feed cache |
| Background Jobs | Inngest | Serverless-friendly; no Redis queue management |
| Auth | Clerk | Operator/customer/admin roles; best DX |
| Email | Resend | Simple API; great Next.js integration |
| Maps | Mapbox GL JS | Cheaper than Google at national scale |
| File Storage | Cloudflare R2 + Cloudflare Images | No egress fees; automatic image resizing |
| Payments | Stripe | Future use |
| Monitoring | Sentry | Error tracking from day one |
| Mobile (future) | React Native + Expo | Shared business logic with web |
| Package Manager | pnpm workspaces | Monorepo support |
| Testing | Vitest (unit) + Playwright (E2E) | |

## Key Architectural Decisions

- **No microservices to start.** Monorepo Next.js app until a clear bottleneck forces a split.
- **No WebSockets.** 30-min location polling via Redis cache is sufficient. Revisit if real-time requirements change.
- **ORM is Prisma.** All queries through Prisma; `$queryRaw` is reserved for PostGIS geospatial queries (`ST_DWithin`, `ST_Distance`) which Prisma cannot express natively.
- **No inline SQL.** All queries through the ORM; raw queries only for PostGIS where unavoidable.
- **No `useEffect` for data fetching.** Use React Server Components or SWR/React Query.
- **Images always through Cloudflare Images.** Never serve raw R2 uploads to the client.
- **Feed via materialized view.** Refreshed by background job — never computed inline.
