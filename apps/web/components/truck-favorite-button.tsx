'use client'

import { useTransition } from 'react'
import { SignedIn } from '@clerk/nextjs'
import { favoriteTruckAction, unfavoriteTruckAction } from '@/app/actions/favorites'

/**
 * <SignedIn>-wrapped, same as PhotoLikeButton in truck-reviews.tsx — nothing
 * rendered for a signed-out visitor, no count (favorites are private, see
 * docs/features/account.md#favorites). No local state, same as
 * PhotoLikeButton — isFavorited is a server prop that refreshes via
 * revalidatePath after the action's round-trip, not an optimistic update.
 */
export function TruckFavoriteButton({
  truckId,
  slug,
  isFavorited,
}: {
  truckId: string
  slug: string
  isFavorited: boolean
}) {
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
              await unfavoriteTruckAction(truckId, slug)
            } else {
              await favoriteTruckAction(truckId, slug)
            }
          })
        }
        className="text-lg disabled:opacity-50"
      >
        {isFavorited ? '♥' : '♡'}
      </button>
    </SignedIn>
  )
}
