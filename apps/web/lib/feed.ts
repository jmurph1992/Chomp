import { db } from '@chomp/db'
import type { FeedItem } from '@chomp/types'

export const FEED_PAGE_SIZE = 20

/** Validates a raw `?page=` search param into a positive page number, defaulting to 1. */
export function parsePageParam(value: string | undefined): number {
  if (!value) return 1
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return 1
  return parsed
}

type FeedItemRow = {
  type: 'review' | 'photo'
  itemId: string
  truckId: string
  userId: string
  rating: number | null
  content: string | null
  imageUrl: string | null
  createdAt: Date
  truckSlug: string
  truckName: string
  authorDisplayName: string | null
}

export async function getFeedPage(
  page: number,
  pageSize: number = FEED_PAGE_SIZE,
): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  const offset = (page - 1) * pageSize

  const rows = await db.$queryRaw<FeedItemRow[]>`
    SELECT
      fi.type,
      fi.item_id AS "itemId",
      fi.truck_id AS "truckId",
      fi.user_id AS "userId",
      fi.rating,
      fi.content,
      fi.image_url AS "imageUrl",
      fi.created_at AS "createdAt",
      t.slug AS "truckSlug",
      t.name AS "truckName",
      u.display_name AS "authorDisplayName"
    FROM feed_items fi
    JOIN trucks t ON t.id = fi.truck_id
    JOIN users u ON u.id = fi.user_id
    ORDER BY fi.created_at DESC
    LIMIT ${pageSize + 1} OFFSET ${offset}
  `

  const hasMore = rows.length > pageSize
  const items = rows.slice(0, pageSize).map(
    (row): FeedItem => ({
      type: row.type,
      itemId: row.itemId,
      truckId: row.truckId,
      userId: row.userId,
      rating: row.rating,
      content: row.content,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt.toISOString(),
      truckSlug: row.truckSlug,
      truckName: row.truckName,
      authorDisplayName: row.authorDisplayName,
    }),
  )

  return { items, hasMore }
}

/**
 * Refreshes the feed_items materialized view. CONCURRENTLY requires the
 * unique index added in migration 20260731120000_add_feed_items_unique_index
 * — this will error until that migration has been applied.
 */
export async function refreshFeedView(): Promise<void> {
  await db.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY feed_items`
}
