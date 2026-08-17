'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@chomp/db'
import { getCurrentUser } from '@/lib/auth'
import {
  favoriteMenuItem,
  favoriteTruck,
  unfavoriteMenuItem,
  unfavoriteTruck,
} from '@/lib/favorites'

/**
 * Not requireOperator-gated — any signed-in user can favorite, not just
 * operators. Revalidates both the truck's own page (so TruckFavoriteButton's
 * isFavorited prop refreshes after the round-trip — same no-local-state,
 * revalidate-and-re-render pattern as PhotoLikeButton/likePhotoAction in
 * app/actions/review-photos.ts) and /account (so the saved list stays fresh).
 */
function revalidateFavoriteSurfaces(slug: string) {
  revalidatePath(`/trucks/${slug}`)
  revalidatePath('/account')
}

export async function favoriteTruckAction(truckId: string, slug: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')

  await favoriteTruck(user.id, truckId)
  revalidateFavoriteSurfaces(slug)
}

export async function unfavoriteTruckAction(truckId: string, slug: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')

  await unfavoriteTruck(user.id, truckId)
  revalidateFavoriteSurfaces(slug)
}

export async function favoriteMenuItemAction(
  truckId: string,
  slug: string,
  menuItemId: string,
): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')

  await favoriteMenuItem(user.id, truckId, menuItemId)
  revalidateFavoriteSurfaces(slug)
}

export async function unfavoriteMenuItemAction(
  truckId: string,
  slug: string,
  menuItemId: string,
): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')

  await unfavoriteMenuItem(user.id, truckId, menuItemId)
  revalidateFavoriteSurfaces(slug)
}

/**
 * Toggled on the truck's own detail page (not /account, unlike
 * notifyFavoriteActive), and only meaningful once a TruckFavorite row
 * exists — the updateMany's where clause enforces "must have favorited
 * this truck first" server-side, not just via the UI only rendering the
 * toggle when isFavorited. No target-user parameter, same IDOR-free
 * pattern as updateNotificationPreferenceAction (app/actions/account.ts):
 * this can only ever touch the caller's own favorite row.
 */
export async function updateEventNotifyPreferenceAction(
  truckId: string,
  slug: string,
  notifyNewEvents: boolean,
): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')

  const result = await db.truckFavorite.updateMany({
    where: { truckId, userId: user.id },
    data: { notifyNewEvents },
  })
  if (result.count === 0) throw new Error('Favorite this truck first')

  revalidatePath(`/trucks/${slug}`)
}
