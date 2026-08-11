import { db, type User } from '@chomp/db'
import type { AdminUserView } from '@chomp/types'

/**
 * Every user for the admin user-management queue — deliberately unfiltered,
 * same posture as lib/trucks.ts#getAllTrucksForAdmin. No pagination in v1,
 * consistent with this app's other admin `findMany`-everything queries.
 */
export async function getAllUsersForAdmin(): Promise<AdminUserView[]> {
  const users = await db.user.findMany({
    include: { _count: { select: { ownedTrucks: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    ownedTruckCount: user._count.ownedTrucks,
    createdAt: user.createdAt.toISOString(),
  }))
}

export async function getUserById(userId: string): Promise<User | null> {
  return db.user.findUnique({ where: { id: userId } })
}
