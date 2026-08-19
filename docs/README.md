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
| [Manager Invites](./features/manager-invites.md) | Done | Owner-only, email-gated shareable link to add a manager; cancel/remove built in |
| [Account Page](./features/account.md) | Phase 1 done | Profile details (embedded Clerk `UserProfile`) + a read-only reviews list, including orphaned ones; favorites deferred |
| [Account Erasure](./features/account-erasure.md) | Done | Hard-deletes the `User` row via an Inngest job; anonymizes (not deletes) reviews/photos; sole-truck-owner conflicts blocked and routed to a generic admin moderation queue |
| [Navigation](./features/navigation.md) | Done | Site-wide responsive nav (desktop row / mobile drawer), role-filtered links, smart back-nav on the truck page, operator dashboard breadcrumbs |
| [Email (Resend)](./features/email.md) | Plumbing only | `sendEmail()` foundation — first consumer is favorite-activation notifications; roadmap item 7h still unbuilt |
| [Favorite Activation Notifications](./features/favorite-notifications.md) | Done | Opt-in email (via `/account`) to a truck's favoriters when it goes "Active now" |
| [Events](./features/events.md) | Done | Operator CRUD for truck events; public display on the truck page + live feed section; geocoded "Get Directions"; opt-in per-truck notification |
| [Content Reporting](./features/content-reporting.md) | Done | Customer-facing report action on reviews and photos; new photo moderation capability; dedicated `/admin/reports` queue |
| [Search](./features/search.md) | Done | Unbounded name search across all verified trucks; geocoded city/zip re-centering of the nearby search |
| [Demo Mode](./features/demo-mode.md) | Done | Read-only public `demo.<domain>` deployment with no Clerk wiring — sample data, write actions hidden or redirect to sign up on the real app |

---

> When a new feature is built, add a row to the Features table above and create a corresponding file at `/docs/features/<feature-name>.md`.
