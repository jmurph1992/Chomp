'use client'

import { useEffect, useState } from 'react'
import type { TruckMapMarker, TruckSearchResult } from '@chomp/types'
import {
  filterTrucksByCuisine,
  filterTrucksByFavorite,
  filterTrucksByMinRating,
  getDistinctCuisines,
  sortTrucks,
  type TruckSortBy,
} from '@chomp/utils'
import { getNearbyTrucksAction, searchLocationAction, searchTrucksByNameAction } from '@/app/actions/trucks'
import { TruckMap } from '@/components/truck-map'
import { TruckList } from '@/components/truck-list'
import { TruckListControls } from '@/components/truck-list-controls'
import { TruckSearchResults } from '@/components/truck-search-results'

type Props = {
  initialTrucks: TruckMapMarker[]
  defaultCenter: { lat: number; lng: number }
  viewerSignedIn: boolean
}

/**
 * Owns the truck data (including the geolocation-triggered refresh, moved
 * here from TruckMap) and the Map/List toggle + filter/sort state, so both
 * views render from one shared, consistent set — filtering a truck out
 * removes it from the map too, not just the list.
 */
export function TruckDiscovery({ initialTrucks, defaultCenter, viewerSignedIn }: Props) {
  const [trucks, setTrucks] = useState(initialTrucks)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [sortBy, setSortBy] = useState<TruckSortBy>('distance')
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [minRating, setMinRating] = useState<number | null>(null)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [nameSearchResults, setNameSearchResults] = useState<TruckSearchResult[] | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        setCenter({ lat: latitude, lng: longitude })
        const nearby = await getNearbyTrucksAction(latitude, longitude)
        setTrucks(nearby)
      },
      () => {
        // Permission denied or unavailable — keep the default-region results.
      },
      { timeout: 8000 },
    )
  }, [])

  async function handleSearchByName(query: string) {
    setNameSearchResults(await searchTrucksByNameAction(query))
  }

  // Runs the exact same two steps the geolocation success callback above
  // does — re-centering "here" via a typed city/zip is just a second way to
  // produce the same { lat, lng } input, not a separate code path.
  async function handleSearchByLocation(query: string): Promise<boolean> {
    const coords = await searchLocationAction(query)
    if (!coords) return false

    setCenter(coords)
    const nearby = await getNearbyTrucksAction(coords.lat, coords.lng)
    setTrucks(nearby)
    return true
  }

  // Cuisine options come from the full (unfiltered) set so the dropdown
  // doesn't shrink as other filters narrow the visible trucks.
  const cuisineOptions = getDistinctCuisines(trucks)

  const visibleTrucks = filterTrucksByFavorite(
    filterTrucksByMinRating(filterTrucksByCuisine(trucks, selectedCuisines), minRating),
    viewerSignedIn && onlyFavorites,
  )

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded border p-1" role="radiogroup" aria-label="View">
          <button
            type="button"
            role="radio"
            aria-checked={view === 'map'}
            onClick={() => setView('map')}
            className={`rounded px-3 py-1 text-sm ${view === 'map' ? 'bg-primary text-primary-foreground' : ''}`}
          >
            Map
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view === 'list'}
            onClick={() => setView('list')}
            className={`rounded px-3 py-1 text-sm ${view === 'list' ? 'bg-primary text-primary-foreground' : ''}`}
          >
            List
          </button>
        </div>

        <TruckListControls
          sortBy={sortBy}
          onSortByChange={setSortBy}
          cuisineOptions={cuisineOptions}
          selectedCuisines={selectedCuisines}
          onSelectedCuisinesChange={setSelectedCuisines}
          minRating={minRating}
          onMinRatingChange={setMinRating}
          viewerSignedIn={viewerSignedIn}
          onlyFavorites={onlyFavorites}
          onOnlyFavoritesChange={setOnlyFavorites}
          onSearchByName={handleSearchByName}
          onSearchByLocation={handleSearchByLocation}
        />
      </div>

      {nameSearchResults !== null ? (
        <div>
          <button type="button" onClick={() => setNameSearchResults(null)} className="mb-3 text-sm underline">
            ← Back to nearby trucks
          </button>
          <TruckSearchResults trucks={nameSearchResults} />
        </div>
      ) : view === 'map' ? (
        <TruckMap
          trucks={visibleTrucks}
          defaultCenter={defaultCenter}
          center={center}
          viewerSignedIn={viewerSignedIn}
        />
      ) : (
        <TruckList trucks={sortTrucks(visibleTrucks, sortBy)} />
      )}
    </div>
  )
}
