/**
 * Pure validation only — deliberately has zero server-only imports (no db,
 * no storage). create-truck-form.tsx/truck-profile-form.tsx (client
 * components) import directly from here rather than from lib/trucks.ts,
 * which transitively pulls in lib/storage.ts's Node-only deps (node:crypto,
 * the AWS SDK) via deleteTruck's Cloudflare Images cleanup and breaks the
 * client bundle. Plain modules like this get bundled whole by webpack when a
 * client component imports them — unlike 'use server' action files, which
 * Next.js compiles into lightweight RPC stubs instead of inlining their
 * implementation. Never import lib/trucks.ts directly from a client
 * component; go through a server action instead. Same pattern as
 * lib/review-validation.ts.
 */
export const MAX_TRUCK_NAME_LENGTH = 100
export const MAX_TRUCK_DESCRIPTION_LENGTH = 2000
export const MAX_CUISINE_TYPES = 10
const MAX_CUISINE_TYPE_LENGTH = 30

export function isValidTruckName(name: string): boolean {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= MAX_TRUCK_NAME_LENGTH
}

export function isValidTruckDescription(description: string | null): boolean {
  if (description === null) return true
  return description.length <= MAX_TRUCK_DESCRIPTION_LENGTH
}

export function isValidCuisineType(cuisineType: string[]): boolean {
  return (
    cuisineType.length <= MAX_CUISINE_TYPES &&
    cuisineType.every((c) => typeof c === 'string' && c.length > 0 && c.length <= MAX_CUISINE_TYPE_LENGTH)
  )
}

/** null means "not set" (valid — the Open/Closed indicator just doesn't render). Otherwise must be a real IANA identifier. */
export function isValidTimezone(timezone: string | null): boolean {
  if (timezone === null) return true
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone })
    return true
  } catch {
    return false
  }
}
