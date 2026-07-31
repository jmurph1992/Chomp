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

// ─── Trucks ───────────────────────────────────────────────────────────────────

/** Minimal truck shape for rendering a map marker. */
export type TruckMapMarker = {
  id: string
  slug: string
  name: string
  cuisineType: string[]
  logoUrl: string | null
  lat: number
  lng: number
  distanceMeters: number
}

/** A single schedule entry as shown on a truck's detail page. */
export type TruckScheduleEntry = {
  id: string
  dayOfWeek: number | null
  specificDate: string | null
  startTime: string | null
  endTime: string | null
  locationNote: string | null
  address: string | null
  isCancelled: boolean
}

/** Full shape for the truck detail page. */
export type TruckDetail = {
  id: string
  slug: string
  name: string
  description: string | null
  cuisineType: string[]
  phone: string | null
  website: string | null
  instagram: string | null
  logoUrl: string | null
  coverUrl: string | null
  currentAddress: string | null
  schedule: TruckScheduleEntry[]
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
