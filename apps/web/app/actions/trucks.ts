'use server'

import type { TruckMapMarker } from '@chomp/types'
import { getNearbyTrucks } from '@/lib/trucks'
import { DEFAULT_RADIUS_METERS, isValidLat, isValidLng } from '@/lib/geo'

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
