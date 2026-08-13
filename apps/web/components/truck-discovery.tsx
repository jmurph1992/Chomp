'use client'

import { useEffect, useState } from 'react'
import type { TruckMapMarker } from '@chomp/types'
import {
  filterTrucksByCuisine,
  filterTrucksByMinRating,
  getDistinctCuisines,
  sortTrucks,
  type TruckSortBy,
} from '@chomp/utils'
import { getNearbyTrucksAction } from '@/app/actions/trucks'
import { TruckMap } from '@/components/truck-map'
import { TruckList } from '@/components/truck-list'
import { TruckListControls } from '@/components/truck-list-controls'

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

  // Cuisine options come from the full (unfiltered) set so the dropdown
  // doesn't shrink as other filters narrow the visible trucks.
  const cuisineOptions = getDistinctCuisines(trucks)

  const visibleTrucks = filterTrucksByMinRating(filterTrucksByCuisine(trucks, selectedCuisines), minRating)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded border p-1" role="radiogroup" aria-label="View">
          <button
            type="button"
            role="radio"
            aria-checked={view === 'map'}
            onClick={() => setView('map')}
            className={`rounded px-3 py-1 text-sm ${view === 'map' ? 'bg-gray-900 text-white' : ''}`}
          >
            Map
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view === 'list'}
            onClick={() => setView('list')}
            className={`rounded px-3 py-1 text-sm ${view === 'list' ? 'bg-gray-900 text-white' : ''}`}
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
        />
      </div>

      {view === 'map' ? (
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
