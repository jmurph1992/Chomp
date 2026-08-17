import Link from 'next/link'
import type { TruckSearchResult } from '@chomp/types'

/**
 * Deliberately lighter than TruckList — no distance/rating/favorite toggle,
 * since a name-searched truck may have no current location at all and this
 * isn't meant to replicate the nearby list, just help you find and jump to
 * a specific truck's own page. See TruckDiscovery for how this replaces the
 * Map/List toggle content while a name search is active.
 */
export function TruckSearchResults({ trucks }: { trucks: TruckSearchResult[] }) {
  if (trucks.length === 0) {
    return <p className="text-gray-500">No trucks match that search.</p>
  }

  return (
    <ul className="divide-y">
      {trucks.map((truck) => (
        <li key={truck.id} className="py-3">
          <Link href={`/trucks/${truck.slug}`}>
            <p className="font-medium">{truck.name}</p>
            <p className="text-sm text-gray-500">
              {truck.cuisineType.length > 0 && truck.cuisineType.join(', ')}
              {truck.currentAddress && (truck.cuisineType.length > 0 ? ` · ${truck.currentAddress}` : truck.currentAddress)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
