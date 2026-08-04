# Chomp — Documentation

## Architecture
| Document | Description |
|---|---|
| [Tech Stack](./architecture/stack.md) | Framework, services, and tooling decisions with rationale |
| [Database Schema](./architecture/schema.md) | Full PostgreSQL + PostGIS schema with design notes |

## Features
| Document | Status | Description |
|---|---|---|
| [Auth](./features/auth.md) | Done | Clerk sign-in/sign-up, session middleware, and DB user sync |
| [Map View](./features/map.md) | Done | Truck discovery map and nearby-trucks query |
| [Truck Detail Page](./features/truck-detail.md) | Done | Profile, schedule, and menu for a single truck |
| [Reviews](./features/reviews.md) | Done | Rating + text reviews, edit/delete own, minimal admin hide |
| [Public Feed](./features/feed.md) | Done | Recent high-rated reviews/photos, materialized view + refresh route |
| [Operator Dashboard](./features/operator-dashboard.md) | Done | Truck creation, profile/menu/schedule/location CRUD, truck switcher |
| [Photo Upload](./features/photo-upload.md) | Done | R2 + Cloudflare Images hybrid upload, powers review/menu/logo photos |
| [Rate Limiting](./features/rate-limiting.md) | Done | Shared Upstash Redis primitive limiting review submission, truck creation, upload-slot requests |
| [Truck Verification](./features/truck-verification.md) | Done | Admin review queue; new trucks hidden from the map/public page until verified |

---

> When a new feature is built, add a row to the Features table above and create a corresponding file at `/docs/features/<feature-name>.md`.
