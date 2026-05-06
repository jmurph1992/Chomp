CREATE MATERIALIZED VIEW feed_items AS
  SELECT 'review' AS type, r.id AS item_id, r.truck_id, r.user_id,
    r.rating, r.body AS content, null::text AS image_url, r.created_at
  FROM reviews r
  WHERE r.rating >= 4 AND r.created_at > now() - interval '30 days' AND r.is_visible = true
  UNION ALL
  SELECT 'photo' AS type, rp.id AS item_id, rp.truck_id, rp.user_id,
    null::int AS rating, rp.caption AS content, rp.url AS image_url, rp.created_at
  FROM review_photos rp
  WHERE rp.likes_count >= 2 AND rp.created_at > now() - interval '30 days'
  ORDER BY created_at DESC;

CREATE INDEX ON feed_items (truck_id, created_at DESC);