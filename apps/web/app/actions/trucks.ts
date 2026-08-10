'use server'

import { revalidatePath } from 'next/cache'
import type { CreateTruckInput, TruckMapMarker, TruckProfileInput } from '@chomp/types'
import { createTruck, deleteTruck, getNearbyTrucks, updateTruckProfile } from '@/lib/trucks'
import { DEFAULT_RADIUS_METERS, isValidLat, isValidLng } from '@/lib/geo'
import { getCurrentUser } from '@/lib/auth'
import { requireOperator } from '@/lib/operators'
import { checkRateLimit, truckCreationLimiter } from '@/lib/rate-limit'

/**
 * Owner-only guard for deletion — requireOperator alone only proves the
 * caller manages this specific truck, not that they're specifically its
 * owner. Same tiny pattern already duplicated in app/actions/invites.ts
 * rather than shared across actions files.
 */
async function requireOwner(truckId: string) {
  const { role } = await requireOperator(truckId)
  if (role !== 'owner') throw new Error('Only the truck owner can do this')
}

/**
 * Called from the client map once browser geolocation resolves, to re-center
 * results on the user's real location instead of the server-rendered default region.
 */
export async function getNearbyTrucksAction(lat: number, lng: number): Promise<TruckMapMarker[]> {
  if (!isValidLat(lat) || !isValidLng(lng)) {
    return []
  }
  return getNearbyTrucks(lat, lng, DEFAULT_RADIUS_METERS)
}

/**
 * Creates a truck and makes the caller its owner — no prior truck ownership is
 * required (that's the point), only being signed in. Returns the new truck
 * rather than calling redirect() itself — the caller wraps this in try/catch
 * for validation errors, and Next's redirect() throws internally in a way
 * that a surrounding catch would swallow. The client navigates on success instead.
 */
export async function createTruckAction(
  input: CreateTruckInput,
): Promise<{ id: string; slug: string }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')
  await checkRateLimit(truckCreationLimiter, user.id)

  const truck = await createTruck(user, input)
  revalidatePath('/dashboard')
  return truck
}

export async function updateTruckProfileAction(
  truckId: string,
  slug: string,
  input: TruckProfileInput,
): Promise<void> {
  await requireOperator(truckId)
  await updateTruckProfile(truckId, input)
  revalidatePath(`/dashboard/${truckId}`)
  revalidatePath(`/trucks/${slug}`)
}

/**
 * Permanently deletes a truck. Doesn't call redirect() itself — same
 * reasoning as createTruckAction: Next's redirect() throws in a way a
 * surrounding try/catch would swallow, so the client navigates to
 * /dashboard on success instead. No revalidatePath for /trucks/[slug] — that
 * route 404s the moment the row is gone, regardless of caching.
 */
export async function deleteTruckAction(truckId: string, confirmedName: string): Promise<void> {
  await requireOwner(truckId)
  await deleteTruck(truckId, confirmedName)
  revalidatePath('/dashboard')
  revalidatePath('/')
}
