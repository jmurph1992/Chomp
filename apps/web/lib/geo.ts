export const DEFAULT_RADIUS_METERS = 16_093 // 10 miles
export const MAX_RADIUS_METERS = 80_467 // 50 miles — hard cap regardless of input

/** Placeholder launch-city fallback until we know a real default market. */
export const DEFAULT_LOCATION = {
  lat: 30.2672,
  lng: -97.7431, // Austin, TX
}

export function isValidLat(lat: unknown): lat is number {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90
}

export function isValidLng(lng: unknown): lng is number {
  return typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180
}

/** Clamps a requested radius into (0, MAX_RADIUS_METERS] so a caller can't force an unbounded scan. */
export function clampRadiusMeters(radiusMeters: number): number {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return DEFAULT_RADIUS_METERS
  return Math.min(radiusMeters, MAX_RADIUS_METERS)
}
