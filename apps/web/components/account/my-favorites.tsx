'use client'

import { useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { FavoriteMenuItemView, FavoriteTruckView } from '@chomp/types'
import { formatUsd } from '@chomp/utils'
import { unfavoriteMenuItemAction, unfavoriteTruckAction } from '@/app/actions/favorites'

/**
 * Unlike MyReviews, these rows get an unfavorite button right here — a saved
 * list that can't remove items from itself would be bad UX, and there's no
 * separate "edit" page for a favorite the way there is for a review. Not
 * confirm-gated — removing a favorite isn't destructive/irreversible the way
 * removing a manager or deleting a truck is.
 */
export function MyFavorites({
  trucks,
  menuItems,
}: {
  trucks: FavoriteTruckView[]
  menuItems: FavoriteMenuItemView[]
}) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-medium">Favorite trucks</h3>
        {trucks.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">No favorite trucks yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {trucks.map((truck) => (
              <FavoriteTruckRow key={truck.truckId} truck={truck} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-medium">Favorite menu items</h3>
        {menuItems.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">No favorite menu items yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {menuItems.map((item) => (
              <FavoriteMenuItemRow key={item.menuItemId} item={item} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function FavoriteTruckRow({ truck }: { truck: FavoriteTruckView }) {
  const [isPending, startTransition] = useTransition()

  return (
    <li className="flex items-center justify-between gap-3 border-t pt-2 text-sm">
      <Link href={`/trucks/${truck.truckSlug}`} className="flex items-center gap-2">
        {truck.logoUrl && (
          <Image
            src={truck.logoUrl}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="h-8 w-8 rounded-full object-cover"
          />
        )}
        <span>
          {truck.truckName}
          {truck.cuisineType.length > 0 && (
            <span className="text-gray-500"> — {truck.cuisineType.join(', ')}</span>
          )}
        </span>
      </Link>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await unfavoriteTruckAction(truck.truckId, truck.truckSlug)
          })
        }
        className="text-red-600 disabled:opacity-50"
      >
        Remove
      </button>
    </li>
  )
}

function FavoriteMenuItemRow({ item }: { item: FavoriteMenuItemView }) {
  const [isPending, startTransition] = useTransition()

  return (
    <li className="flex items-center justify-between gap-3 border-t pt-2 text-sm">
      <Link href={`/trucks/${item.truckSlug}`} className="flex items-center gap-2">
        {item.imageUrl && (
          <Image
            src={item.imageUrl}
            alt=""
            width={32}
            height={32}
            unoptimized
            className="h-8 w-8 rounded object-cover"
          />
        )}
        <span>
          {item.name}
          {item.price !== null && <span className="text-gray-500"> — {formatUsd(item.price)}</span>}
          <span className="text-gray-500"> @ {item.truckName}</span>
        </span>
      </Link>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await unfavoriteMenuItemAction(item.truckId, item.truckSlug, item.menuItemId)
          })
        }
        className="text-red-600 disabled:opacity-50"
      >
        Remove
      </button>
    </li>
  )
}
