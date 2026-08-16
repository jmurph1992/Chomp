import { db } from '@chomp/db'
import { appUrl } from './site-url'

export type ActivatedTruck = { name: string; slug: string }

export async function getTruckNameAndSlug(truckId: string): Promise<ActivatedTruck | null> {
  return db.truck.findUnique({ where: { id: truckId }, select: { name: true, slug: true } })
}

/**
 * Direct truck favorites only — not menu-item favorites — kept consistent
 * with the same "keep the two favorite signals separate" reasoning applied
 * to the map/list filter (see truck-list-filters.ts).
 */
export async function getOptedInFavoriterEmails(truckId: string): Promise<string[]> {
  const favorites = await db.truckFavorite.findMany({
    where: { truckId, user: { notifyFavoriteActive: true } },
    select: { user: { select: { email: true } } },
  })
  return favorites.map((f) => f.user.email)
}

/** One email per recipient, never cc/bcc — a favoriter should never see another favoriter's address. */
export function activationEmailHtml(truck: ActivatedTruck): string {
  return `
    <p>${truck.name} just went active — <a href="${appUrl()}/trucks/${truck.slug}">see where they are</a>.</p>
    <p>Manage your notification preferences on your <a href="${appUrl()}/account">account page</a>.</p>
  `
}
