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
  isAvailable: boolean
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

// ─── Operator dashboard ─────────────────────────────────────────────────────

/** A truck the signed-in user operates, for the dashboard's truck switcher. */
export type OperatedTruck = {
  id: string
  slug: string
  name: string
  role: 'owner' | 'manager'
}

/** Input for creating a new truck (fields the operator supplies). */
export type CreateTruckInput = {
  name: string
  description: string | null
  cuisineType: string[]
}

/**
 * Writable truck profile fields. Deliberately excludes verificationStatus/
 * verificationNote (admin-only, set outside this feature), ownerId, and slug
 * (immutable after creation) — never accept these as input to an update, not
 * just hide them in a form.
 */
export type TruckProfileInput = {
  name: string
  description: string | null
  cuisineType: string[]
  phone: string | null
  website: string | null
  instagram: string | null
  logoUrl: string | null
  coverUrl: string | null
  isActive: boolean
}

/**
 * pending: awaiting admin review. verified: publicly visible. rejected: admin
 * declined pre-launch (see the note for why). onHold: was verified, an admin
 * pulled it back off the map (see the note for why) without treating it as a
 * fresh rejection.
 */
export type VerificationStatusValue = 'pending' | 'verified' | 'rejected' | 'onHold'

/** Full profile as shown in the dashboard edit form — status fields are read-only here. */
export type TruckProfileEdit = TruckProfileInput & {
  id: string
  slug: string
  verificationStatus: VerificationStatusValue
  verificationNote: string | null
}

/** A truck as shown in the admin verification queue. */
export type AdminTruckView = {
  id: string
  slug: string
  name: string
  description: string | null
  cuisineType: string[]
  phone: string | null
  website: string | null
  instagram: string | null
  ownerEmail: string
  verificationStatus: VerificationStatusValue
  verificationNote: string | null
  createdAt: string
}

/** Input for creating/updating a menu category. */
export type MenuCategoryInput = {
  name: string
}

/** Input for creating/updating a menu item. */
export type MenuItemInput = {
  name: string
  description: string | null
  price: number | null
  imageUrl: string | null
  isAvailable: boolean
  isFeatured: boolean
  dietaryFlags: string[]
}

/** Input for creating/updating a schedule entry. */
export type ScheduleEntryInput = {
  dayOfWeek: number | null
  specificDate: string | null
  startTime: string | null
  endTime: string | null
  locationNote: string | null
  address: string | null
  isCancelled: boolean
}

/** Input for posting a truck's current location. */
export type PostLocationInput = {
  lat: number
  lng: number
  address: string | null
}

// ─── Photo upload ─────────────────────────────────────────────────────────────

/** Presigned R2 POST — client uploads the file directly to `url` with `fields`. */
export type UploadSlot = {
  url: string
  fields: Record<string, string>
  key: string
}

/** A photo attached to a review. */
export type ReviewPhotoView = {
  id: string
  url: string
  caption: string | null
  likesCount: number
  isLikedByViewer: boolean
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
  photo: ReviewPhotoView | null
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
  truckSlug: string
  truckName: string
  authorDisplayName: string | null
}
