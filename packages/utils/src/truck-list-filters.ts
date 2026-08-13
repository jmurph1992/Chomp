/**
 * Pure client-side sort/filter logic for the nearby-trucks list view.
 * Operates on an already-fetched truck array — no query re-fetch involved.
 * Pure/framework-agnostic so it can be reused by a future native client.
 */

export type TruckSortBy = 'distance' | 'rating'

type SortableTruck = { distanceMeters: number; averageRating: number | null }

/**
 * 'rating' sorts descending; a truck with no reviews yet (averageRating
 * null) always sorts last, regardless of direction — there's no rating to
 * compare. 'distance' re-sorts explicitly rather than trusting the caller
 * preserved the SQL's own ORDER BY, so this function is correct standalone.
 */
export function sortTrucks<T extends SortableTruck>(trucks: T[], sortBy: TruckSortBy): T[] {
  const copy = [...trucks]

  if (sortBy === 'distance') {
    return copy.sort((a, b) => a.distanceMeters - b.distanceMeters)
  }

  return copy.sort((a, b) => {
    if (a.averageRating === null && b.averageRating === null) return 0
    if (a.averageRating === null) return 1
    if (b.averageRating === null) return -1
    return b.averageRating - a.averageRating
  })
}

type CuisineTagged = { cuisineType: string[] }

/**
 * Empty selection = no filter. Otherwise OR-match: a truck with any
 * cuisineType value in selectedCuisines matches (a Mexican/BBQ fusion truck
 * should show under either filter, not require both).
 */
export function filterTrucksByCuisine<T extends CuisineTagged>(
  trucks: T[],
  selectedCuisines: string[],
): T[] {
  if (selectedCuisines.length === 0) return trucks
  const selected = new Set(selectedCuisines)
  return trucks.filter((truck) => truck.cuisineType.some((c) => selected.has(c)))
}

type Rated = { averageRating: number | null }

/**
 * null = no filter. A non-null minRating excludes trucks with no reviews
 * yet — there's no rating to compare against the threshold. Boundary is
 * inclusive (averageRating === minRating passes).
 */
export function filterTrucksByMinRating<T extends Rated>(trucks: T[], minRating: number | null): T[] {
  if (minRating === null) return trucks
  return trucks.filter((truck) => truck.averageRating !== null && truck.averageRating >= minRating)
}

/** Flattened, deduped, alphabetically sorted — drawn from whatever's actually in the passed-in array. */
export function getDistinctCuisines<T extends CuisineTagged>(trucks: T[]): string[] {
  const all = new Set<string>()
  for (const truck of trucks) {
    for (const cuisine of truck.cuisineType) all.add(cuisine)
  }
  return [...all].sort()
}
