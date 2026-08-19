'use client'

import { useTransition } from 'react'
import { updateEventNotifyPreferenceAction } from '@/app/actions/favorites'
import { SignedInSafe } from '@/components/signed-in-safe'

/**
 * Only rendered when the caller has already favorited this truck — enforces
 * the "must favorite first" rule at the UI layer;
 * updateEventNotifyPreferenceAction's scoped updateMany enforces it
 * server-side regardless (see app/actions/favorites.ts). Same
 * no-local-state, revalidate-and-re-render pattern as TruckFavoriteButton.
 */
export function TruckEventNotifyToggle({
  truckId,
  slug,
  isFavorited,
  notifyNewEvents,
}: {
  truckId: string
  slug: string
  isFavorited: boolean
  notifyNewEvents: boolean
}) {
  const [isPending, startTransition] = useTransition()

  if (!isFavorited) return null

  return (
    <SignedInSafe>
      <label className="flex items-center gap-1 text-sm text-gray-500">
        <input
          type="checkbox"
          disabled={isPending}
          checked={notifyNewEvents}
          onChange={(e) =>
            startTransition(async () => {
              await updateEventNotifyPreferenceAction(truckId, slug, e.target.checked)
            })
          }
        />
        Notify me about new events
      </label>
    </SignedInSafe>
  )
}
