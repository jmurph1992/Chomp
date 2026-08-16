import { db } from '@chomp/db'
import type { PostLocationInput } from '@chomp/types'
import { isValidExpiresAt } from '@chomp/utils'
import { isValidLat, isValidLng } from './geo'
import { inngest } from '@/inngest/client'

export async function getCurrentLocation(
  truckId: string,
): Promise<{ address: string | null; reportedAt: string; expiresAt: string | null } | null> {
  const row = await db.truckLocation.findFirst({
    where: { truckId, isCurrent: true },
    select: { address: true, reportedAt: true, expiresAt: true },
  })
  return row
    ? {
        address: row.address,
        reportedAt: row.reportedAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() ?? null,
      }
    : null
}

/**
 * Records a new current location for a truck, retiring the previous one.
 * Coordinates come from the operator's browser geolocation (see
 * docs/features/operator-dashboard.md) — validated here the same way the
 * public nearby-trucks query validates its input, since this is a write path
 * reachable from a server action.
 *
 * Fires app/truck.activated only on a real off->on transition (no current,
 * unexpired location existed immediately before this post) — checked inside
 * the same transaction as the write so the check can't race it, same rigor
 * extendLocation's WHERE clause already applies. Re-posting while already
 * active (same spot or a new one) never re-fires; see
 * docs/features/favorite-notifications.md.
 */
export async function postLocation(truckId: string, input: PostLocationInput): Promise<void> {
  if (!isValidLat(input.lat) || !isValidLng(input.lng)) {
    throw new Error(`Invalid coordinates: (${input.lat}, ${input.lng})`)
  }
  if (!isValidExpiresAt(input.expiresAt)) {
    throw new Error(`Invalid expiresAt: ${input.expiresAt}`)
  }

  const { isActivation } = await db.$transaction(async (tx) => {
    const activeLocation = await tx.truckLocation.findFirst({
      where: {
        truckId,
        isCurrent: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    })

    await tx.truckLocation.updateMany({
      where: { truckId, isCurrent: true },
      data: { isCurrent: false },
    })

    // geom is Unsupported() in Prisma — must be written via raw SQL, same as
    // packages/db/prisma/seed.ts.
    await tx.$executeRaw`
      INSERT INTO truck_locations (id, truck_id, geom, address, is_current, reported_at, expires_at)
      VALUES (
        gen_random_uuid(),
        ${truckId}::uuid,
        ST_MakePoint(${input.lng}, ${input.lat})::geography,
        ${input.address},
        true,
        now(),
        ${new Date(input.expiresAt)}
      )
    `

    return { isActivation: !activeLocation }
  })

  if (isActivation) {
    await inngest.send({ name: 'app/truck.activated', data: { truckId } })
  }
}

/**
 * Pushes the current location's expiry further out without re-sharing GPS —
 * only while it's still active. The WHERE clause (not just the UI gate in
 * the form) is the real server-side enforcement that an expired location
 * can't be revived by extension; an operator whose window lapsed must post
 * fresh instead.
 */
export async function extendLocation(truckId: string, expiresAt: string): Promise<void> {
  if (!isValidExpiresAt(expiresAt)) {
    throw new Error(`Invalid expiresAt: ${expiresAt}`)
  }

  const result = await db.truckLocation.updateMany({
    where: {
      truckId,
      isCurrent: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    data: { expiresAt: new Date(expiresAt) },
  })

  if (result.count === 0) {
    throw new Error('No active location to extend — post a fresh location instead')
  }
}
