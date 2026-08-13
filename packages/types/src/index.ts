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
  /** Always false for an anonymous (signed-out) request. */
  isFavorited: boolean
  /** Null means no (visible) reviews yet — distinct from a real 0, which can't happen (rating is 1-5). */
  averageRating: number | null
  reviewCount: number
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
  /**
   * Optional — this type is shared with lib/menu.ts#getMenuForEdit (the
   * operator dashboard's menu editor), which has no viewer/favoriting
   * concept. Only lib/trucks.ts#getTruckBySlug (the public truck page) sets
   * this, always to a real boolean; false for an anonymous visitor.
   */
  isFavorited?: boolean
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
  /**
   * Non-null iff a current TruckLocation row exists at all — use this, not
   * currentAddress, to decide whether to show any location UI, since
   * currentAddress can be null even with a real current row if the operator
   * left it blank.
   */
  locationReportedAt: string | null
  /** Null means "does not expire" — only possible for legacy pre-feature rows. */
  locationExpiresAt: string | null
  /** Null together iff locationReportedAt is null — coordinates are required on every postLocation call, unlike address. */
  locationLat: number | null
  locationLng: number | null
  schedule: TruckScheduleEntry[]
  menu: MenuCategoryView[]
  /** False for an anonymous visitor — see getTruckBySlug's optional viewerId param. */
  isFavorited: boolean
}

// ─── Operator dashboard ─────────────────────────────────────────────────────

/** A truck the signed-in user operates, for the dashboard's truck switcher. */
export type OperatedTruck = {
  id: string
  slug: string
  name: string
  role: 'owner' | 'manager'
}

export type InviteStatusValue = 'pending' | 'accepted' | 'cancelled' | 'expired'

/**
 * A pending/resolved manager invite as shown on the dashboard's team page.
 * Includes the token (needed for the "Copy link" action on any row, not just
 * a freshly-created one) — safe here because this view is only ever rendered
 * on the owner-gated /team page, never anywhere an unauthenticated visitor or
 * non-owner operator could see it.
 */
export type TruckInviteView = {
  id: string
  invitedEmail: string
  token: string
  status: InviteStatusValue
  createdAt: string
  expiresAt: string
}

/** A current manager on a truck's team page (owner isn't shown through this list). */
export type TruckManagerView = {
  userId: string
  email: string
  displayName: string | null
}

/**
 * Unauthenticated-safe preview for the invite-claim landing page — never
 * includes invitedEmail, so a leaked link can't be used to see who was invited.
 */
export type InvitePreview = {
  truckName: string
  status: InviteStatusValue
  expiresAt: string
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
  /** ISO instant, computed client-side from a DurationPreset (see @chomp/utils). */
  expiresAt: string
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

/**
 * A single review as shown on a truck's detail page. userId is nullable —
 * null means the author was erased (see docs/features/account-erasure.md);
 * the review is anonymized, not gone, and userDisplayName/userAvatarUrl are
 * set to a "Deleted user" placeholder rather than omitted.
 */
export type ReviewView = {
  id: string
  truckId: string
  userId: string | null
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

/**
 * A review as shown in the admin moderation queue, across all trucks.
 * userEmail is nullable for the same reason ReviewView.userId is — an
 * erased author.
 */
export type AdminReviewView = {
  id: string
  truckId: string
  truckSlug: string
  truckName: string
  userDisplayName: string | null
  userEmail: string | null
  rating: number
  body: string | null
  isVisible: boolean
  moderationNote: string | null
  moderatedByEmail: string | null
  moderatedAt: string | null
  createdAt: string
}

/**
 * A review as shown on the signed-in user's own account page, across all
 * trucks. Unlike ReviewView, truckId/truckSlug/truckName are all nullable —
 * null means the truck was deleted (see
 * docs/features/operator-dashboard.md#truck-deletion); the review is
 * orphaned, not gone, and this is the one place it's actually shown to
 * anyone. photo deliberately omits like-state (likesCount/isLikedByViewer)
 * from ReviewPhotoView — irrelevant on a read-only list of your own reviews.
 */
export type MyReviewView = {
  id: string
  truckId: string | null
  truckSlug: string | null
  truckName: string | null
  rating: number
  body: string | null
  isVisible: boolean
  createdAt: string
  photo: { id: string; url: string; caption: string | null } | null
}

// ─── Favorites ────────────────────────────────────────────────────────────────

/** A truck the signed-in user has saved, for the account page's "Favorite trucks" list. */
export type FavoriteTruckView = {
  truckId: string
  truckSlug: string
  truckName: string
  logoUrl: string | null
  cuisineType: string[]
}

/** A menu item the signed-in user has saved, for the account page's "Favorite menu items" list. */
export type FavoriteMenuItemView = {
  menuItemId: string
  truckId: string
  name: string
  price: number | null
  imageUrl: string | null
  truckSlug: string
  truckName: string
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export type FeedItemType = 'review' | 'photo'

/** userId nullable — null means the author was erased; authorDisplayName is "Deleted user" in that case, not omitted. */
export type FeedItem = {
  type: FeedItemType
  itemId: string
  truckId: string
  userId: string | null
  rating: number | null
  content: string | null
  imageUrl: string | null
  createdAt: string
  truckSlug: string
  truckName: string
  authorDisplayName: string | null
}

// ─── Account erasure & moderation ──────────────────────────────────────────────

/** A user as shown in the admin user-management queue. */
export type AdminUserView = {
  id: string
  email: string
  displayName: string | null
  role: 'customer' | 'operator' | 'admin'
  ownedTruckCount: number
  createdAt: string
}

export type ModerationQueueStatusValue = 'open' | 'resolved' | 'dismissed'
export type ModerationQueueReasonValue = 'userErasureBlockedBySoleOwnership'

/**
 * An entry in the generic admin moderation queue. blockingTrucks is resolved
 * live from the entry's stored truck ids, not read back verbatim — the ids
 * themselves are a snapshot only, see docs/features/account-erasure.md.
 */
/** managers is who adminReassignTruckOwnerAction can hand the truck to — only an existing manager is eligible. */
export type ModerationQueueEntryView = {
  id: string
  reason: ModerationQueueReasonValue
  status: ModerationQueueStatusValue
  subjectUserId: string | null
  subjectEmail: string
  subjectDisplayName: string | null
  blockingTrucks: {
    id: string
    name: string
    slug: string
    managers: { userId: string; email: string; displayName: string | null }[]
  }[]
  note: string | null
  createdAt: string
  resolvedAt: string | null
  resolvedByEmail: string | null
  resolutionNote: string | null
}
