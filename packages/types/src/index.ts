/**
 * Shared TypeScript types used across web and (future) mobile apps.
 * Domain-specific types live here; Prisma-generated types are re-exported from @chomp/db.
 */

// ─── API response envelope ────────────────────────────────────────────────────

/** Standard shape for all successful API responses. */
export type ApiSuccess<T> = {
  data: T
}

/** Standard shape for all API error responses. */
export type ApiError = {
  error: string
  code: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── Location ─────────────────────────────────────────────────────────────────

/** GeoJSON-compatible coordinate pair. */
export type Coordinates = {
  lat: number
  lng: number
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export type FeedItemType = 'review' | 'photo'

export type FeedItem = {
  type: FeedItemType
  itemId: string
  truckId: string
  userId: string
  rating: number | null
  content: string | null
  imageUrl: string | null
  createdAt: string
}
