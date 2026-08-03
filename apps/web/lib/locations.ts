import { db } from '@chomp/db'
import type { PostLocationInput } from '@chomp/types'
import { isValidLat, isValidLng } from './geo'

export async function getCurrentLocation(
  truckId: string,
): Promise<{ address: string | null; reportedAt: string } | null> {
  const row = await db.truckLocation.findFirst({
    where: { truckId, isCurrent: true },
    select: { address: true, reportedAt: true },
  })
  return row ? { address: row.address, reportedAt: row.reportedAt.toISOString() } : null
}

/**
 * Records a new current location for a truck, retiring the previous one.
 * Coordinates come from the operator's browser geolocation (see
 * docs/features/operator-dashboard.md) — validated here the same way the
 * public nearby-trucks query validates its input, since this is a write path
 * reachable from a server action.
 */
export async function postLocation(truckId: string, input: PostLocationInput): Promise<void> {
  if (!isValidLat(input.lat) || !isValidLng(input.lng)) {
    throw new Error(`Invalid coordinates: (${input.lat}, ${input.lng})`)
  }

  await db.$transaction(async (tx) => {
    await tx.truckLocation.updateMany({
      where: { truckId, isCurrent: true },
      data: { isCurrent: false },
    })

    // geom is Unsupported() in Prisma — must be written via raw SQL, same as
    // packages/db/prisma/seed.ts.
    await tx.$executeRaw`
      INSERT INTO truck_locations (id, truck_id, geom, address, is_current, reported_at)
      VALUES (
        gen_random_uuid(),
        ${truckId}::uuid,
        ST_MakePoint(${input.lng}, ${input.lat})::geography,
        ${input.address},
        true,
        now()
      )
    `
  })
}
