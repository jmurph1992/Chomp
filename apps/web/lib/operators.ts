import { db, type User } from '@chomp/db'
import type { OperatedTruck } from '@chomp/types'
import { getCurrentUser } from './auth'

/** Every truck the user operates (owner or manager), for the dashboard switcher. */
export async function getOperatedTrucks(userId: string): Promise<OperatedTruck[]> {
  const rows = await db.truckOperator.findMany({
    where: { userId },
    include: { truck: { select: { id: true, slug: true, name: true } } },
  })
  return rows.map((row) => ({
    id: row.truck.id,
    slug: row.truck.slug,
    name: row.truck.name,
    role: row.role,
  }))
}

export async function getTruckOperatorRole(
  truckId: string,
  userId: string,
): Promise<'owner' | 'manager' | null> {
  const row = await db.truckOperator.findUnique({
    where: { truckId_userId: { truckId, userId } },
  })
  return row?.role ?? null
}

/**
 * The authorization boundary for the whole operator dashboard. Every dashboard
 * page AND every server action must call this — page-level checks alone don't
 * stop someone from calling a server action directly with a different truckId.
 * Checks membership for this *specific* truckId, never "is an operator of
 * something" — that distinction is the difference between this being secure
 * and an IDOR vulnerability letting one operator edit another's truck.
 */
export async function requireOperator(
  truckId: string,
): Promise<{ user: User; role: 'owner' | 'manager' }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')

  const role = await getTruckOperatorRole(truckId, user.id)
  if (!role) throw new Error('Not authorized to manage this truck')

  return { user, role }
}
