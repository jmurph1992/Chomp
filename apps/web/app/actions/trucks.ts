'use server'

import { revalidatePath } from 'next/cache'
import type { CreateTruckInput, TruckMapMarker, TruckProfileInput } from '@chomp/types'
import { createTruck, getNearbyTrucks, updateTruckProfile } from '@/lib/trucks'
import { DEFAULT_RADIUS_METERS, isValidLat, isValidLng } from '@/lib/geo'
import { getCurrentUser } from '@/lib/auth'
import { requireOperator } from '@/lib/operators'

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
