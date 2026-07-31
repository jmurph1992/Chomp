import { db } from '@chomp/db'
import type { TruckDetail, TruckMapMarker } from '@chomp/types'
import { clampRadiusMeters, isValidLat, isValidLng } from './geo'

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
  }
}
