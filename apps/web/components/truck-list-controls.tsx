'use client'

import { useState, useTransition } from 'react'
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
  viewerSignedIn: boolean
  onlyFavorites: boolean
  onOnlyFavoritesChange: (onlyFavorites: boolean) => void
  onSearchByName: (query: string) => Promise<void>
  /** Returns whether a location was actually found, so this control can show its own "not found" message. */
  onSearchByLocation: (query: string) => Promise<boolean>
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
  viewerSignedIn,
  onlyFavorites,
  onOnlyFavoritesChange,
  onSearchByName,
  onSearchByLocation,
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
      <NameSearchForm onSearch={onSearchByName} />
      <LocationSearchForm onSearch={onSearchByLocation} />

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

      {viewerSignedIn && (
        <button
          type="button"
          aria-pressed={onlyFavorites}
          onClick={() => onOnlyFavoritesChange(!onlyFavorites)}
          className={`rounded border px-2 py-1 ${
            onlyFavorites ? 'border-gray-900 bg-gray-900 text-white' : ''
          }`}
        >
          My favorites
        </button>
      )}
    </div>
  )
}

/** Explicit submit only — no live/debounced search-as-you-type. */
function NameSearchForm({ onSearch }: { onSearch: (query: string) => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!query.trim()) return
        startTransition(() => onSearch(query))
      }}
      className="flex items-center gap-1"
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search trucks by name"
        className="rounded border px-2 py-1"
      />
      <button type="submit" disabled={isPending || !query.trim()} className="rounded border px-2 py-1 disabled:opacity-50">
        Search
      </button>
    </form>
  )
}

function LocationSearchForm({ onSearch }: { onSearch: (query: string) => Promise<boolean> }) {
  const [query, setQuery] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!query.trim()) return
        setNotFound(false)
        startTransition(async () => {
          const found = await onSearch(query)
          if (!found) setNotFound(true)
        })
      }}
      className="flex items-center gap-1"
    >
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setNotFound(false)
        }}
        placeholder="Search location (city or zip)"
        className="rounded border px-2 py-1"
      />
      <button type="submit" disabled={isPending || !query.trim()} className="rounded border px-2 py-1 disabled:opacity-50">
        Go
      </button>
      {notFound && <span className="text-red-600">Couldn&apos;t find that location.</span>}
    </form>
  )
}
