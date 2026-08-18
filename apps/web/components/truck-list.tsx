'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { SignedIn } from '@clerk/nextjs'
import type { TruckMapMarker } from '@chomp/types'
import { formatDistanceMiles } from '@chomp/utils'
import { favoriteTruckAction, unfavoriteTruckAction } from '@/app/actions/favorites'
import { StarRating } from '@/components/ui/star-rating'
import { TicketCard } from '@/components/ui/ticket-card'

type Props = {
  trucks: TruckMapMarker[]
}

/**
 * viewerSignedIn isn't needed here the way TruckMap needs it — this is real
 * React with normal context, so <SignedIn> (inside ListFavoriteButton) gates
 * itself directly, same as TruckFavoriteButton on the truck detail page.
 */
export function TruckList({ trucks }: Props) {
  if (trucks.length === 0) {
    return <p className="text-muted-foreground">No trucks match your filters.</p>
  }

  return (
    <ul className="space-y-3">
      {trucks.map((truck) => (
        <li key={truck.id}>
          <TicketCard>
            <div className="flex items-center justify-between gap-4">
              <Link href={`/trucks/${truck.slug}`} className="flex-1">
                <p className="font-display tracking-wide">{truck.name}</p>
                <p className="mt-0.5 text-sm text-char">
                  {formatDistanceMiles(truck.distanceMeters)}
                  {truck.cuisineType.length > 0 && ` · ${truck.cuisineType.join(', ')}`}
                </p>
                {truck.reviewCount > 0 ? (
                  <StarRating
                    rating={truck.averageRating!}
                    label={`${truck.averageRating!.toFixed(1)} (${truck.reviewCount})`}
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 text-sm text-char">No reviews yet</p>
                )}
              </Link>
              <ListFavoriteButton truck={truck} />
            </div>
          </TicketCard>
        </li>
      ))}
    </ul>
  )
}

/**
 * Unlike TruckFavoriteButton (truck-favorite-button.tsx), which relies on a
 * server-rendered prop refreshing via revalidatePath, this list's truck data
 * lives in TruckDiscovery's client-held state (from the geolocation fetch),
 * which nothing automatically re-fetches after a toggle. So this owns local
 * optimistic state instead — same reasoning already used for the map
 * popup's favorite button in truck-map.tsx, just via useState since this is
 * real React rather than raw DOM.
 */
function ListFavoriteButton({ truck }: { truck: TruckMapMarker }) {
  const [isFavorited, setIsFavorited] = useState(truck.isFavorited)
  const [isPending, startTransition] = useTransition()

  return (
    <SignedIn>
      <button
        type="button"
        disabled={isPending}
        aria-pressed={isFavorited}
        title={isFavorited ? 'Remove from favorites' : 'Save this truck'}
        onClick={() =>
          startTransition(async () => {
            if (isFavorited) {
              await unfavoriteTruckAction(truck.id, truck.slug)
            } else {
              await favoriteTruckAction(truck.id, truck.slug)
            }
            setIsFavorited(!isFavorited)
          })
        }
        className="text-lg text-marigold disabled:opacity-50"
      >
        {isFavorited ? '♥' : '♡'}
      </button>
    </SignedIn>
  )
}
