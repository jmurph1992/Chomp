'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import { SignedIn } from '@clerk/nextjs'
import type { MenuCategoryView, MenuItemView } from '@chomp/types'
import { formatUsd } from '@chomp/utils'
import { getUniqueDietaryFlags, filterMenuByDietaryFlags } from '@/lib/menu'
import { favoriteMenuItemAction, unfavoriteMenuItemAction } from '@/app/actions/favorites'

type Props = {
  truckId: string
  slug: string
  menu: MenuCategoryView[]
}

/** Same no-local-state, revalidate-and-re-render pattern as TruckFavoriteButton/PhotoLikeButton. */
function MenuItemFavoriteButton({
  truckId,
  slug,
  item,
}: {
  truckId: string
  slug: string
  item: MenuItemView
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <SignedIn>
      <button
        type="button"
        disabled={isPending}
        aria-pressed={item.isFavorited}
        title={item.isFavorited ? 'Remove from favorites' : 'Save this item'}
        onClick={() =>
          startTransition(async () => {
            if (item.isFavorited) {
              await unfavoriteMenuItemAction(truckId, slug, item.id)
            } else {
              await favoriteMenuItemAction(truckId, slug, item.id)
            }
          })
        }
        className="disabled:opacity-50"
      >
        {item.isFavorited ? '♥' : '♡'}
      </button>
    </SignedIn>
  )
}

export function TruckMenu({ truckId, slug, menu }: Props) {
  const [activeFlags, setActiveFlags] = useState<string[]>([])
  const allFlags = useMemo(() => getUniqueDietaryFlags(menu), [menu])
  const filteredMenu = useMemo(
    () => filterMenuByDietaryFlags(menu, activeFlags),
    [menu, activeFlags],
  )

  if (menu.length === 0) return null

  function toggleFlag(flag: string) {
    setActiveFlags((prev) =>
      prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag],
    )
  }

  return (
    <section className="mt-6">
      <h2 className="text-xl font-semibold">Menu</h2>

      {allFlags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {allFlags.map((flag) => (
            <button
              key={flag}
              type="button"
              onClick={() => toggleFlag(flag)}
              aria-pressed={activeFlags.includes(flag)}
              className={`rounded-full border px-3 py-1 text-sm ${
                activeFlags.includes(flag)
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 text-gray-700'
              }`}
            >
              {flag}
            </button>
          ))}
        </div>
      )}

      {filteredMenu.length === 0 ? (
        <p className="mt-4 text-gray-500">No items match the selected filters.</p>
      ) : (
        filteredMenu.map((category) => (
          <div key={category.id} className="mt-4">
            <h3 className="text-lg font-medium">{category.name}</h3>
            <ul className="mt-2 space-y-4">
              {category.items.map((item) => (
                <li key={item.id} className="flex gap-4">
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16 rounded object-cover"
                    />
                  )}
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium">{item.name}</span>
                      {item.price !== null && (
                        <span className="text-gray-500">{formatUsd(item.price)}</span>
                      )}
                      <MenuItemFavoriteButton truckId={truckId} slug={slug} item={item} />
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-500">{item.description}</p>
                    )}
                    {item.dietaryFlags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.dietaryFlags.map((flag) => (
                          <span
                            key={flag}
                            className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
