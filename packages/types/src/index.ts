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

/** A single menu item as shown on a truck's detail page. */
export type MenuItemView = {
  id: string
  name: string
  description: string | null
  /** Whole-dollar amount (e.g. 12.5), not cents — use formatUsd, not formatPrice. */
  price: number | null
  imageUrl: string | null
  isFeatured: boolean
  dietaryFlags: string[]
}

/** A menu category with its (available) items. */
export type MenuCategoryView = {
  id: string
  name: string
  items: MenuItemView[]
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
  menu: MenuCategoryView[]
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

/** A single review as shown on a truck's detail page. */
export type ReviewView = {
  id: string
  truckId: string
  userId: string
  userDisplayName: string | null
  userAvatarUrl: string | null
  rating: number
  body: string | null
  isVisible: boolean
  createdAt: string
}

export type ReviewSummary = {
  averageRating: number | null
  reviewCount: number
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
