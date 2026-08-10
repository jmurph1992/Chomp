import { db } from '@chomp/db'
import type { FavoriteMenuItemView, FavoriteTruckView } from '@chomp/types'

/**
 * upsert with an empty update gives idempotent favorite/unfavorite with no
 * transaction needed — unlike lib/review-photos.ts#likePhoto, there's no
 * denormalized counter to keep in sync here (favorites are private, no
 * public count — see docs/features/account.md#favorites), so there's
 * nothing that needs atomicity beyond the single row write.
 */
export async function favoriteTruck(userId: string, truckId: string): Promise<void> {
  await db.truckFavorite.upsert({
    where: { truckId_userId: { truckId, userId } },
    create: { truckId, userId },
    update: {},
  })
}

export async function unfavoriteTruck(userId: string, truckId: string): Promise<void> {
  await db.truckFavorite.deleteMany({ where: { truckId, userId } })
}

/**
 * Scoped by truckId too, same IDOR-prevention idiom as lib/menu.ts — a
 * menuItemId that doesn't actually belong to truckId is rejected, not
 * silently favorited under the wrong truck.
 */
export async function favoriteMenuItem(
  userId: string,
  truckId: string,
  menuItemId: string,
): Promise<void> {
  const item = await db.menuItem.findFirst({ where: { id: menuItemId, truckId } })
  if (!item) throw new Error('Menu item not found')

  await db.menuItemFavorite.upsert({
    where: { menuItemId_userId: { menuItemId, userId } },
    create: { menuItemId, userId },
    update: {},
  })
}

export async function unfavoriteMenuItem(
  userId: string,
  truckId: string,
  menuItemId: string,
): Promise<void> {
  await db.menuItemFavorite.deleteMany({
    where: { menuItemId, userId, menuItem: { truckId } },
  })
}

/** Every truck a user has saved, newest first, for the account page. */
export async function getFavoriteTrucksForUser(userId: string): Promise<FavoriteTruckView[]> {
  const rows = await db.truckFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      truck: { select: { id: true, slug: true, name: true, logoUrl: true, cuisineType: true } },
    },
  })
  return rows.map((row) => ({
    truckId: row.truck.id,
    truckSlug: row.truck.slug,
    truckName: row.truck.name,
    logoUrl: row.truck.logoUrl,
    cuisineType: row.truck.cuisineType,
  }))
}

/** Every menu item a user has saved, newest first, for the account page. */
export async function getFavoriteMenuItemsForUser(userId: string): Promise<FavoriteMenuItemView[]> {
  const rows = await db.menuItemFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      menuItem: {
        select: {
          id: true,
          truckId: true,
          name: true,
          price: true,
          imageUrl: true,
          truck: { select: { slug: true, name: true } },
        },
      },
    },
  })
  return rows.map((row) => ({
    menuItemId: row.menuItem.id,
    truckId: row.menuItem.truckId,
    name: row.menuItem.name,
    price: row.menuItem.price ? row.menuItem.price.toNumber() : null,
    imageUrl: row.menuItem.imageUrl,
    truckSlug: row.menuItem.truck.slug,
    truckName: row.menuItem.truck.name,
  }))
}
