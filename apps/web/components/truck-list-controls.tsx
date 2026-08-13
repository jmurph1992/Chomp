'use client'

import type { TruckSortBy } from '@chomp/utils'

const MIN_RATING_PRESETS = [3, 4, 4.5] as const

type Props = {
  sortBy: TruckSortBy
  onSortByChange: (sortBy: TruckSortBy) => void
  cuisineOptions: string[]
  selectedCuisines: string[]
  onSelectedCuisinesChange: (cuisines: string[]) => void
  minRating: number | null
  onMinRatingChange: (minRating: number | null) => void
}

/** Filters apply to both the map and the list (see TruckDiscovery) — this
 * one control row drives both views regardless of which is showing. */
export function TruckListControls({
  sortBy,
  onSortByChange,
  cuisineOptions,
  selectedCuisines,
  onSelectedCuisinesChange,
  minRating,
  onMinRatingChange,
}: Props) {
  function toggleCuisine(cuisine: string) {
    onSelectedCuisinesChange(
      selectedCuisines.includes(cuisine)
        ? selectedCuisines.filter((c) => c !== cuisine)
        : [...selectedCuisines, cuisine],
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-1">
        Sort by
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as TruckSortBy)}
          className="rounded border px-2 py-1"
        >
          <option value="distance">Distance</option>
          <option value="rating">Rating</option>
        </select>
      </label>

      {cuisineOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cuisineOptions.map((cuisine) => (
            <button
              key={cuisine}
              type="button"
              aria-pressed={selectedCuisines.includes(cuisine)}
              onClick={() => toggleCuisine(cuisine)}
              className={`rounded border px-2 py-1 ${
                selectedCuisines.includes(cuisine) ? 'border-gray-900 bg-gray-900 text-white' : ''
              }`}
            >
              {cuisine}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1">
        <button
          type="button"
          aria-pressed={minRating === null}
          onClick={() => onMinRatingChange(null)}
          className={`rounded border px-2 py-1 ${minRating === null ? 'border-gray-900 bg-gray-900 text-white' : ''}`}
        >
          Any rating
        </button>
        {MIN_RATING_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={minRating === preset}
            onClick={() => onMinRatingChange(preset)}
            className={`rounded border px-2 py-1 ${minRating === preset ? 'border-gray-900 bg-gray-900 text-white' : ''}`}
          >
            {preset}+
          </button>
        ))}
      </div>
    </div>
  )
}
