/**
 * Forward geocoding for event addresses (typed text -> coordinates), via
 * Mapbox's Geocoding API. Reuses NEXT_PUBLIC_MAPBOX_TOKEN server-side rather
 * than a new secret — Mapbox public tokens are scoped for exactly this kind
 * of read (same token already used client-side by TruckMap), unlike the
 * R2/Cloudflare Images credentials which are genuinely secret.
 *
 * Never throws: a no-match or a Mapbox-side failure both resolve to null so
 * a caller can degrade to "address text only, no pin" rather than blocking
 * the write it's part of. Only the single top match is used — no
 * disambiguation UI, per the scoping decision.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return null

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`
    const response = await fetch(url)
    if (!response.ok) return null

    const data = (await response.json()) as { features?: { center?: [number, number] }[] }
    const center = data.features?.[0]?.center
    if (!center) return null

    const [lng, lat] = center
    return { lat, lng }
  } catch {
    return null
  }
}
