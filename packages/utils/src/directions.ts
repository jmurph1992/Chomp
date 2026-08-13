/**
 * Builds an external "Get Directions" link for a truck's current location.
 * Pure, dependency-free — same convention as location-freshness.ts.
 * A single Google Maps universal link, not separate Google/Apple links —
 * it opens the native app via deep-link handling on iOS/Android when
 * installed, and falls back to Google Maps on the web otherwise.
 */
export function buildDirectionsUrl(
  address: string | null,
  lat: number | null,
  lng: number | null,
): string | null {
  const destination = address ? address : lat !== null && lng !== null ? `${lat},${lng}` : null
  if (destination === null) return null

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}
