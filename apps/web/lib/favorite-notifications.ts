import { db } from '@chomp/db'
import type { TruckEventView } from '@chomp/types'
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

/**
 * Direct truck favorites, filtered on the per-favorite notifyNewEvents flag
 * — unlike notifyFavoriteActive (a User-level preference), this is opted
 * into per truck on that truck's own detail page, so it lives on
 * TruckFavorite itself rather than User.
 */
export async function getEventNotifyOptedInEmails(truckId: string): Promise<string[]> {
  const favorites = await db.truckFavorite.findMany({
    where: { truckId, notifyNewEvents: true },
    select: { user: { select: { email: true } } },
  })
  return favorites.map((f) => f.user.email)
}

/** One email per recipient, never cc/bcc — same reasoning as activationEmailHtml. */
export function newEventEmailHtml(truck: ActivatedTruck, event: Pick<TruckEventView, 'title'>): string {
  return `
    <p>${truck.name} just posted a new event: <strong>${event.title}</strong> —
    <a href="${appUrl()}/trucks/${truck.slug}">see the details</a>.</p>
    <p>Manage your notification preferences from the truck's own page.</p>
  `
}
