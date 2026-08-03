ALTER TABLE "review_photos" ADD COLUMN "is_visible" BOOLEAN NOT NULL DEFAULT true;

-- Materialized views can't be ALTERed in place — drop and recreate with the
-- photo side now filtered by is_visible, matching how the review side is
-- already filtered. Recreates both indexes from the prior view definitions
-- (the plain lookup index, and the unique index REFRESH ... CONCURRENTLY needs).
DROP MATERIALIZED VIEW feed_items;

CREATE MATERIALIZED VIEW feed_items AS
  SELECT 'review' AS type, r.id AS item_id, r.truck_id, r.user_id,
    r.rating, r.body AS content, null::text AS image_url, r.created_at
  FROM reviews r
  WHERE r.rating >= 4 AND r.created_at > now() - interval '30 days' AND r.is_visible = true
  UNION ALL
  SELECT 'photo' AS type, rp.id AS item_id, rp.truck_id, rp.user_id,
    null::int AS rating, rp.caption AS content, rp.url AS image_url, rp.created_at
  FROM review_photos rp
  WHERE rp.likes_count >= 2 AND rp.created_at > now() - interval '30 days' AND rp.is_visible = true
  ORDER BY created_at DESC;

CREATE INDEX ON feed_items (truck_id, created_at DESC);
CREATE UNIQUE INDEX feed_items_item_id_key ON feed_items (item_id);
