import { db, type User } from '@chomp/db'
import { slugify } from '@chomp/utils'
import type {
  CreateTruckInput,
  TruckDetail,
  TruckMapMarker,
  TruckProfileEdit,
  TruckProfileInput,
} from '@chomp/types'
import { clampRadiusMeters, isValidLat, isValidLng } from './geo'

const MAX_SLUG_ATTEMPTS = 20
export const MAX_TRUCK_NAME_LENGTH = 100
export const MAX_TRUCK_DESCRIPTION_LENGTH = 2000
export const MAX_CUISINE_TYPES = 10
const MAX_CUISINE_TYPE_LENGTH = 30

export function isValidTruckName(name: string): boolean {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= MAX_TRUCK_NAME_LENGTH
}

export function isValidTruckDescription(description: string | null): boolean {
  if (description === null) return true
  return description.length <= MAX_TRUCK_DESCRIPTION_LENGTH
}

export function isValidCuisineType(cuisineType: string[]): boolean {
  return (
    cuisineType.length <= MAX_CUISINE_TYPES &&
    cuisineType.every((c) => typeof c === 'string' && c.length > 0 && c.length <= MAX_CUISINE_TYPE_LENGTH)
  )
}

type NearbyTruckRow = {
  id: string
  slug: string
  name: string
  cuisineType: string[]
  logoUrl: string | null
  lat: number
  lng: number
  distanceMeters: number
}

/**
 * Trucks with a current location within `radiusMeters` of (lat, lng), nearest first.
 * Uses $queryRaw because PostGIS geography columns are Unsupported() in Prisma —
 * values are passed as tagged-template params, never string-concatenated.
 */
export async function getNearbyTrucks(
  lat: number,
  lng: number,
  radiusMeters: number,
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
      ST_Distance(tl.geom, ST_MakePoint(${lng}, ${lat})::geography) AS "distanceMeters"
    FROM trucks t
    JOIN truck_locations tl ON tl.truck_id = t.id AND tl.is_current = true
    WHERE t.is_active = true
      AND ST_DWithin(tl.geom, ST_MakePoint(${lng}, ${lat})::geography, ${radius})
    ORDER BY "distanceMeters" ASC
    LIMIT 100
  `

  return rows
}

export async function getTruckBySlug(slug: string): Promise<TruckDetail | null> {
  const truck = await db.truck.findUnique({
    where: { slug, isActive: true },
    include: {
      locations: { where: { isCurrent: true }, take: 1 },
      schedules: { where: { isCancelled: false } },
      menuCategories: {
        orderBy: { displayOrder: 'asc' },
        include: {
          items: { where: { isAvailable: true }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  if (!truck) return null

  const currentLocation = truck.locations[0]

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
      })),
    })),
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
  }
}

/**
 * Updates only the fields in TruckProfileInput — isVerified, ownerId, and slug
 * are never accepted here, not just omitted from the form.
 */
export async function updateTruckProfile(truckId: string, input: TruckProfileInput): Promise<void> {
  if (!isValidTruckName(input.name)) throw new Error('Invalid truck name')
  if (!isValidTruckDescription(input.description)) throw new Error('Description too long')
  if (!isValidCuisineType(input.cuisineType)) throw new Error('Invalid cuisine type list')

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
    },
  })
}
