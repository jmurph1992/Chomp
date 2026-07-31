-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY, which the feed's
-- refresh route uses so refreshes don't lock out concurrent reads.
-- item_id is unique across the view's UNION ALL of reviews.id and
-- review_photos.id (both independent UUIDs from separate tables).
CREATE UNIQUE INDEX feed_items_item_id_key ON feed_items (item_id);
