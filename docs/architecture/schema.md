# Database Schema

## Platform
PostgreSQL + PostGIS on Neon (serverless Postgres).

All location data uses `geography(Point, 4326)` — this stores coordinates as WGS84
(standard GPS format) and enables accurate distance calculations in meters, not degrees.

---

## Domain: Users & Auth

```sql
-- Clerk manages authentication. This table mirrors Clerk users into the DB
-- so we can build relational data (reviews, ownership, etc.) against them.
users (
  id              uuid PRIMARY KEY,
  clerk_id        text UNIQUE NOT NULL,   -- Clerk's user ID
  email           text UNIQUE NOT NULL,
  role            text NOT NULL,          -- 'customer' | 'operator' | 'admin'
  display_name    text,
  avatar_url      text,
  created_at      timestamptz DEFAULT now()
)
```

---

## Domain: Trucks

```sql
-- Core truck profile. One truck can have multiple operators (owner + managers).
trucks (
  id              uuid PRIMARY KEY,
  owner_id        uuid REFERENCES users(id),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,   -- SEO-friendly URL: /trucks/taco-kings
  description     text,
  cuisine_type    text[],                 -- e.g. ['mexican', 'fusion']
  phone           text,
  website         text,
  instagram       text,
  logo_url        text,
  cover_url       text,
  verification_status text DEFAULT 'pending', -- 'pending' | 'verified' | 'rejected' | 'onHold' — set by admin, see docs/features/truck-verification.md
  verification_note   text,               -- rejection/hold reason, cleared on verify
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
)

-- Allows one user to manage multiple trucks, or multiple users to manage one truck.
truck_operators (
  truck_id        uuid REFERENCES trucks(id),
  user_id         uuid REFERENCES users(id),
  role            text DEFAULT 'owner',   -- 'owner' | 'manager'
  PRIMARY KEY (truck_id, user_id)
)
```

---

## Domain: Location

```sql
-- Each row is a location report. Only one row per truck has is_current = true.
-- Historical rows are kept for future "where has this truck been" features.
truck_locations (
  id              uuid PRIMARY KEY,
  truck_id        uuid REFERENCES trucks(id),
  geom            geography(Point, 4326), -- PostGIS point (lng, lat)
  address         text,                   -- human-readable fallback
  city            text,
  state           text,
  zip             text,
  is_current      boolean DEFAULT true,
  reported_at     timestamptz DEFAULT now(),
  expires_at      timestamptz             -- null means no expiry
)

-- Partial index: only current locations are queried spatially
CREATE INDEX ON truck_locations USING GIST (geom)
  WHERE is_current = true;
```

---

## Domain: Schedules

```sql
-- Supports both recurring weekly schedules (day_of_week) and one-off events (specific_date).
-- A row with day_of_week = 2 and no specific_date means "every Tuesday".
truck_schedules (
  id              uuid PRIMARY KEY,
  truck_id        uuid REFERENCES trucks(id),
  day_of_week     int,              -- 0=Sun through 6=Sat; null if specific_date is set
  specific_date   date,             -- for one-off appearances
  start_time      time,
  end_time        time,
  location_note   text,             -- e.g. "Corner of 5th and Main"
  address         text,
  geom            geography(Point, 4326),
  is_cancelled    boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
)
```

---

## Domain: Menus

```sql
-- Categories group menu items (e.g. Tacos, Drinks, Sides).
menu_categories (
  id              uuid PRIMARY KEY,
  truck_id        uuid REFERENCES trucks(id),
  name            text NOT NULL,
  display_order   int DEFAULT 0     -- controls render order on the menu page
)

-- Individual menu items. dietary_flags supports filtering (vegan, gluten-free, etc.)
menu_items (
  id              uuid PRIMARY KEY,
  category_id     uuid REFERENCES menu_categories(id),
  truck_id        uuid REFERENCES trucks(id),  -- denormalized for simpler queries
  name            text NOT NULL,
  description     text,
  price           numeric(8,2),
  image_url       text,
  is_available    boolean DEFAULT true,
  is_featured     boolean DEFAULT false,
  dietary_flags   text[],           -- e.g. ['vegan', 'gluten-free', 'spicy']
  created_at      timestamptz DEFAULT now()
)
```

---

## Domain: Reviews & Photos

```sql
-- One review per user per truck (enforced by UNIQUE constraint).
-- is_visible allows admins to hide abusive reviews without deleting them.
-- moderation_note/moderated_by_user_id/moderated_at record the reason and
-- who/when for the most recent hide or unhide — see docs/features/reviews.md's
-- "Moderation queue" section.
reviews (
  id                    uuid PRIMARY KEY,
  truck_id              uuid REFERENCES trucks(id),
  user_id               uuid REFERENCES users(id),
  rating                int CHECK (rating BETWEEN 1 AND 5),
  body                  text,
  is_visible            boolean DEFAULT true,
  moderation_note       text,
  moderated_by_user_id  uuid REFERENCES users(id),
  moderated_at          timestamptz,
  created_at            timestamptz DEFAULT now(),
  UNIQUE (truck_id, user_id)
)

-- Photos uploaded by customers alongside reviews.
-- truck_id is denormalized here to avoid a join when building the feed.
review_photos (
  id              uuid PRIMARY KEY,
  review_id       uuid REFERENCES reviews(id),
  user_id         uuid REFERENCES users(id),
  truck_id        uuid REFERENCES trucks(id),
  url             text NOT NULL,
  caption         text,
  likes_count     int DEFAULT 0,    -- denormalized count for fast feed sorting
  created_at      timestamptz DEFAULT now()
)

-- Tracks which users liked which photos. Prevents duplicate likes.
photo_likes (
  photo_id        uuid REFERENCES review_photos(id),
  user_id         uuid REFERENCES users(id),
  created_at      timestamptz DEFAULT now(),
  PRIMARY KEY (photo_id, user_id)
)
```

---

## Domain: Feed

```sql
-- Materialized view combining high-rated reviews and popular photos.
-- Refreshed every 15-30 minutes by a background job (Inngest).
-- Never compute this inline — always read from the view.
CREATE MATERIALIZED VIEW feed_items AS
  SELECT
    'review'        AS type,
    r.id            AS item_id,
    r.truck_id,
    r.user_id,
    r.rating,
    r.body          AS content,
    null            AS image_url,
    r.created_at
  FROM reviews r
  WHERE r.rating >= 4
    AND r.created_at > now() - interval '30 days'
    AND r.is_visible = true

  UNION ALL

  SELECT
    'photo'         AS type,
    rp.id           AS item_id,
    rp.truck_id,
    rp.user_id,
    null            AS rating,
    rp.caption      AS content,
    rp.url          AS image_url,
    rp.created_at
  FROM review_photos rp
  WHERE rp.likes_count >= 2
    AND rp.created_at > now() - interval '30 days'

  ORDER BY created_at DESC;

CREATE INDEX ON feed_items (truck_id, created_at DESC);

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY (used by the feed's
-- refresh route so refreshes don't lock out concurrent reads). Added in
-- migration 20260731120000_add_feed_items_unique_index.
CREATE UNIQUE INDEX feed_items_item_id_key ON feed_items (item_id);
```

Refreshing runs the `CONCURRENTLY` refresh once a day via an Inngest-scheduled
function (`refreshFeedFunction`, cron trigger). See `/docs/features/feed.md`.

---

## Domain: Events

```sql
-- Planned but not yet built. Tracks special truck appearances/events.
truck_events (
  id              uuid PRIMARY KEY,
  truck_id        uuid REFERENCES trucks(id),
  title           text NOT NULL,
  description     text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  address         text,
  geom            geography(Point, 4326),
  created_at      timestamptz DEFAULT now()
)
```

---

## Entity Relationships

```
users
 ├── trucks (via truck_operators)
 │    ├── truck_locations
 │    ├── truck_schedules
 │    ├── menu_categories → menu_items
 │    ├── truck_events
 │    └── reviews → review_photos → photo_likes
 └── reviews, review_photos, photo_likes (as customer)
```
