import { db, type User } from '@chomp/db'
import { slugify } from '@chomp/utils'
import type {
  AdminTruckView,
  CreateTruckInput,
  TruckDetail,
  TruckMapMarker,
  TruckProfileEdit,
  TruckProfileInput,
  TruckSearchResult,
} from '@chomp/types'
import { clampRadiusMeters, isValidLat, isValidLng } from './geo'
import { getUpcomingEventsForTruck } from './events'
import { deleteCloudflareImage, extractCloudflareImageId } from './storage'
import { isValidCuisineType, isValidTimezone, isValidTruckDescription, isValidTruckName } from './truck-validation'
import { inngest } from '@/inngest/client'

export {
  MAX_CUISINE_TYPES,
  MAX_TRUCK_DESCRIPTION_LENGTH,
  MAX_TRUCK_NAME_LENGTH,
  isValidCuisineType,
  isValidTimezone,
  isValidTruckDescription,
  isValidTruckName,
} from './truck-validation'

const MAX_SLUG_ATTEMPTS = 20

type NearbyTruckRow = {
  id: string
  slug: string
  name: string
  cuisineType: string[]
  logoUrl: string | null
  lat: number
  lng: number
  distanceMeters: number
  isFavorited: boolean
  hasFavoritedMenuItem: boolean
  averageRating: number | null
  reviewCount: number
}

/**
 * Trucks with a current location within `radiusMeters` of (lat, lng), nearest first.
 * Uses $queryRaw because PostGIS geography columns are Unsupported() in Prisma —
 * values are passed as tagged-template params, never string-concatenated.
 *
 * viewerId is optional — an anonymous request passes null/undefined, and the
 * LEFT JOIN's `tf.user_id = NULL` never matches (standard SQL three-valued
 * logic), so every truck's isFavorited comes back false, same shape as
 * getVisibleReviewsForTruck's viewerId ?? '' pattern for photo likes.
 */
export async function getNearbyTrucks(
  lat: number,
  lng: number,
  radiusMeters: number,
  viewerId?: string | null,
): Promise<TruckMapMarker[]> {
  if (!isValidLat(lat) || !isValidLng(lng)) {
    throw new Error(`Invalid coordinates: (${lat}, ${lng})`)
  }
  const radius = clampRadiusMeters(radiusMeters)

  const rows = await db.$queryRaw<NearbyTruckRow[]>`
    SELECT
      t.id,
      t.slug,
      t.name,
      t.cuisine_type AS "cuisineType",
      t.logo_url AS "logoUrl",
      ST_Y(tl.geom::geometry) AS "lat",
      ST_X(tl.geom::geometry) AS "lng",
      ST_Distance(tl.geom, ST_MakePoint(${lng}, ${lat})::geography) AS "distanceMeters",
      (tf.user_id IS NOT NULL) AS "isFavorited",
      EXISTS (
        SELECT 1 FROM menu_items mi
        JOIN menu_item_favorites mif ON mif.menu_item_id = mi.id
          AND mif.user_id = ${viewerId ?? null}
        WHERE mi.truck_id = t.id
      ) AS "hasFavoritedMenuItem",
      r.avg_rating AS "averageRating",
      COALESCE(r.review_count, 0)::int AS "reviewCount"
    FROM trucks t
    JOIN truck_locations tl ON tl.truck_id = t.id AND tl.is_current = true
      AND (tl.expires_at IS NULL OR tl.expires_at > now())
    LEFT JOIN truck_favorites tf ON tf.truck_id = t.id AND tf.user_id = ${viewerId ?? null}
    LEFT JOIN (
      SELECT truck_id, AVG(rating)::float AS avg_rating, COUNT(*) AS review_count
      FROM reviews
      WHERE is_visible = true
      GROUP BY truck_id
    ) r ON r.truck_id = t.id
    WHERE t.is_active = true
      AND t.verification_status = 'verified'
      AND ST_DWithin(tl.geom, ST_MakePoint(${lng}, ${lat})::geography, ${radius})
    ORDER BY "distanceMeters" ASC
    LIMIT 100
  `

  return rows
}

export const MAX_SEARCH_RESULTS = 20

/**
 * An unbounded (not distance-limited) search by truck name — unlike
 * getNearbyTrucks, a match doesn't need a current location at all. Same
 * visibility gate every other public read enforces (isActive/verified
 * only). An empty/whitespace query returns [] without querying.
 */
export async function searchTrucksByName(query: string): Promise<TruckSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const rows = await db.truck.findMany({
    where: { isActive: true, verificationStatus: 'verified', name: { contains: trimmed, mode: 'insensitive' } },
    orderBy: { name: 'asc' },
    take: MAX_SEARCH_RESULTS,
    select: {
      id: true,
      slug: true,
      name: true,
      cuisineType: true,
      logoUrl: true,
      locations: { where: { isCurrent: true }, take: 1, select: { address: true } },
    },
  })

  return rows.map((truck) => ({
    id: truck.id,
    slug: truck.slug,
    name: truck.name,
    cuisineType: truck.cuisineType,
    logoUrl: truck.logoUrl,
    currentAddress: truck.locations[0]?.address ?? null,
  }))
}

/**
 * viewerId is optional — same `viewerId ?? ''` pattern getVisibleReviewsForTruck
 * already uses for photo likes: passing '' rather than making the favorites
 * include conditional keeps the Prisma include shape consistent regardless of
 * sign-in state, and an empty-string userId never matches a real row.
 */
export async function getTruckBySlug(
  slug: string,
  viewerId?: string | null,
): Promise<TruckDetail | null> {
  const truck = await db.truck.findUnique({
    where: { slug, isActive: true, verificationStatus: 'verified' },
    include: {
      locations: { where: { isCurrent: true }, take: 1 },
      schedules: { where: { isCancelled: false } },
      favorites: { where: { userId: viewerId ?? '' } },
      menuCategories: {
        orderBy: { displayOrder: 'asc' },
        include: {
          items: {
            where: { isAvailable: true },
            orderBy: { createdAt: 'asc' },
            include: { favorites: { where: { userId: viewerId ?? '' } } },
          },
        },
      },
    },
  })
  if (!truck) return null

  const currentLocation = truck.locations[0]

  // geom is Unsupported() in Prisma (same reason getNearbyTrucks uses raw
  // SQL) — only current-location coordinates are needed here (the Get
  // Directions link's fallback when no address is on file), so this is a
  // second small query rather than folding coordinates into every truck fetch.
  const [coords, upcomingEvents] = await Promise.all([
    currentLocation
      ? db.$queryRaw<{ lat: number; lng: number }[]>`
          SELECT ST_Y(geom::geometry) AS "lat", ST_X(geom::geometry) AS "lng"
          FROM truck_locations
          WHERE truck_id = ${truck.id} AND is_current = true
        `
      : Promise.resolve([]),
    getUpcomingEventsForTruck(truck.id),
  ])

  return {
    id: truck.id,
    slug: truck.slug,
    name: truck.name,
    description: truck.description,
    cuisineType: truck.cuisineType,
    phone: truck.phone,
    website: truck.website,
    instagram: truck.instagram,
    logoUrl: truck.logoUrl,
    coverUrl: truck.coverUrl,
    currentAddress: currentLocation?.address ?? null,
    locationReportedAt: currentLocation?.reportedAt.toISOString() ?? null,
    locationExpiresAt: currentLocation?.expiresAt?.toISOString() ?? null,
    locationLat: coords[0]?.lat ?? null,
    locationLng: coords[0]?.lng ?? null,
    isFavorited: truck.favorites.length > 0,
    notifyNewEvents: truck.favorites[0]?.notifyNewEvents ?? false,
    timezone: truck.timezone,
    schedule: truck.schedules.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      specificDate: s.specificDate ? s.specificDate.toISOString() : null,
      startTime: s.startTime ? s.startTime.toISOString() : null,
      endTime: s.endTime ? s.endTime.toISOString() : null,
      locationNote: s.locationNote,
      address: s.address,
      isCancelled: s.isCancelled,
    })),
    menu: truck.menuCategories.map((category) => ({
      id: category.id,
      name: category.name,
      items: category.items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price ? item.price.toNumber() : null,
        imageUrl: item.imageUrl,
        isFeatured: item.isFeatured,
        isAvailable: item.isAvailable,
        dietaryFlags: item.dietaryFlags,
        isFavorited: item.favorites.length > 0,
      })),
    })),
    upcomingEvents,
  }
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name)
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`
    const existing = await db.truck.findUnique({ where: { slug: candidate } })
    if (!existing) return candidate
  }
  throw new Error(`Could not generate a unique slug for "${name}"`)
}

/**
 * Creates a truck, makes `user` its owner, and upgrades a plain customer to
 * operator. The second (besides the Clerk webhook) legitimate writer of
 * User.role — see docs/features/auth.md. Never downgrades an existing
 * operator/admin.
 */
export async function createTruck(
  user: Pick<User, 'id' | 'role'>,
  input: CreateTruckInput,
): Promise<{ id: string; slug: string }> {
  if (!isValidTruckName(input.name)) throw new Error('Invalid truck name')
  if (!isValidTruckDescription(input.description)) throw new Error('Description too long')
  if (!isValidCuisineType(input.cuisineType)) throw new Error('Invalid cuisine type list')

  const slug = await generateUniqueSlug(input.name)

  const truck = await db.$transaction(async (tx) => {
    const created = await tx.truck.create({
      data: {
        ownerId: user.id,
        name: input.name,
        slug,
        description: input.description,
        cuisineType: input.cuisineType,
      },
    })
    await tx.truckOperator.create({
      data: { truckId: created.id, userId: user.id, role: 'owner' },
    })
    if (user.role === 'customer') {
      await tx.user.update({ where: { id: user.id }, data: { role: 'operator' } })
    }
    return created
  })

  return { id: truck.id, slug: truck.slug }
}

/** Truck profile for the dashboard edit form — unlike getTruckBySlug, not filtered by isActive. */
export async function getTruckForEdit(truckId: string): Promise<TruckProfileEdit | null> {
  const truck = await db.truck.findUnique({ where: { id: truckId } })
  if (!truck) return null

  return {
    id: truck.id,
    slug: truck.slug,
    name: truck.name,
    description: truck.description,
    cuisineType: truck.cuisineType,
    phone: truck.phone,
    website: truck.website,
    instagram: truck.instagram,
    logoUrl: truck.logoUrl,
    coverUrl: truck.coverUrl,
    isActive: truck.isActive,
    timezone: truck.timezone,
    verificationStatus: truck.verificationStatus,
    verificationNote: truck.verificationNote,
  }
}

/**
 * Updates only the fields in TruckProfileInput — verificationStatus,
 * verificationNote, ownerId, and slug are never accepted here, not just
 * omitted from the form.
 */
export async function updateTruckProfile(truckId: string, input: TruckProfileInput): Promise<void> {
  if (!isValidTruckName(input.name)) throw new Error('Invalid truck name')
  if (!isValidTruckDescription(input.description)) throw new Error('Description too long')
  if (!isValidCuisineType(input.cuisineType)) throw new Error('Invalid cuisine type list')
  if (!isValidTimezone(input.timezone)) throw new Error('Invalid timezone')

  await db.truck.update({
    where: { id: truckId },
    data: {
      name: input.name,
      description: input.description,
      cuisineType: input.cuisineType,
      phone: input.phone,
      website: input.website,
      instagram: input.instagram,
      logoUrl: input.logoUrl,
      coverUrl: input.coverUrl,
      isActive: input.isActive,
      timezone: input.timezone,
    },
  })
}

/**
 * All trucks for the admin verification queue — deliberately unfiltered
 * (unlike every customer-facing query above), since an admin needs to see
 * pending/rejected trucks to review them and verified trucks to be able to
 * put one on hold.
 */
export async function getAllTrucksForAdmin(): Promise<AdminTruckView[]> {
  const trucks = await db.truck.findMany({
    include: { owner: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return trucks.map((truck) => ({
    id: truck.id,
    slug: truck.slug,
    name: truck.name,
    description: truck.description,
    cuisineType: truck.cuisineType,
    phone: truck.phone,
    website: truck.website,
    instagram: truck.instagram,
    ownerEmail: truck.owner.email,
    verificationStatus: truck.verificationStatus,
    verificationNote: truck.verificationNote,
    createdAt: truck.createdAt.toISOString(),
  }))
}

/**
 * Approves a truck (from any prior status) — clears any rejection/hold note.
 * Fires app/truck.verification-decided after the write (fire-and-forget,
 * same as postLocation/createEvent — nothing prior to read atomically with
 * this write) so every operator on the truck gets notified; see
 * lib/verification-notifications.ts.
 */
export async function verifyTruck(truckId: string): Promise<void> {
  await db.truck.update({
    where: { id: truckId },
    data: { verificationStatus: 'verified', verificationNote: null },
  })
  await inngest.send({ name: 'app/truck.verification-decided', data: { truckId, decision: 'verified', note: null } })
}

/** Declines a truck pre-launch. Requires a reason so the operator/admin trail is clear. */
export async function rejectTruck(truckId: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error('A rejection reason is required')

  await db.truck.update({
    where: { id: truckId },
    data: { verificationStatus: 'rejected', verificationNote: reason },
  })
  await inngest.send({
    name: 'app/truck.verification-decided',
    data: { truckId, decision: 'rejected', note: reason },
  })
}

/**
 * Pulls a previously verified truck back off the map without treating it as a
 * fresh rejection — same visibility effect as pending/rejected (only
 * verificationStatus === 'verified' trucks are ever shown to customers), but
 * keeps the distinct status so the admin queue and operator dashboard can
 * tell "was never approved" apart from "was approved, then pulled."
 */
export async function holdTruck(truckId: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error('A hold reason is required')

  await db.truck.update({
    where: { id: truckId },
    data: { verificationStatus: 'onHold', verificationNote: reason },
  })
  await inngest.send({ name: 'app/truck.verification-decided', data: { truckId, decision: 'onHold', note: reason } })
}

/**
 * Permanently deletes a truck. Requires the caller to have typed the truck's
 * exact current name first — the strongest confirmation gate in this app,
 * proportionate to this being the only truly irreversible action here.
 *
 * A single db.truck.delete() does the entire cascade at the DB level:
 * TruckOperator/TruckLocation/TruckSchedule/MenuCategory/MenuItem/TruckEvent/
 * TruckInvite rows are all removed (onDelete: Cascade), and Review/
 * ReviewPhoto rows are orphaned rather than deleted (onDelete: SetNull) —
 * customer-authored content survives with truckId cleared, invisible
 * everywhere in the product but kept for record-keeping.
 *
 * Cloudflare Images assets aren't touched by any DB cascade, so every asset
 * URL still attached to this truck (logo, cover, menu-item photos, review
 * photos) is gathered *before* the delete — the rows holding those URLs
 * won't exist afterward — and best-effort cleaned up after the delete
 * succeeds, mirroring lib/review-photos.ts's existing cleanup pattern.
 */
export async function deleteTruck(truckId: string, confirmedName: string): Promise<void> {
  const truck = await db.truck.findUnique({
    where: { id: truckId },
    select: {
      name: true,
      logoUrl: true,
      coverUrl: true,
      menuItems: { select: { imageUrl: true } },
      reviewPhotos: { select: { url: true } },
    },
  })
  if (!truck) throw new Error('Truck not found')
  if (confirmedName.trim() !== truck.name) {
    throw new Error('Truck name does not match — deletion cancelled')
  }

  await db.truck.delete({ where: { id: truckId } })

  const urls = [
    truck.logoUrl,
    truck.coverUrl,
    ...truck.menuItems.map((item) => item.imageUrl),
    ...truck.reviewPhotos.map((photo) => photo.url),
  ]
  for (const url of urls) {
    const imageId = url ? extractCloudflareImageId(url) : null
    if (imageId) await deleteCloudflareImage(imageId)
  }
}
