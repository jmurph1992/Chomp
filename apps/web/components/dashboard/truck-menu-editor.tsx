'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { MenuCategoryView, MenuItemInput, MenuItemView } from '@chomp/types'
import {
  createMenuCategoryAction,
  createMenuItemAction,
  deleteMenuCategoryAction,
  deleteMenuItemAction,
  updateMenuItemAction,
} from '@/app/actions/menu'
import { ImageUploadField } from '@/components/image-upload-field'

type Props = { truckId: string; slug: string; menu: MenuCategoryView[] }

export function TruckMenuEditor({ truckId, slug, menu }: Props) {
  const router = useRouter()
  const [newCategoryName, setNewCategoryName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await action()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {menu.map((category) => (
        <MenuCategorySection
          key={category.id}
          truckId={truckId}
          slug={slug}
          category={category}
          onMutate={run}
          isPending={isPending}
        />
      ))}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!newCategoryName.trim()) return
          run(async () => {
            await createMenuCategoryAction(truckId, slug, { name: newCategoryName.trim() })
            setNewCategoryName('')
          })
        }}
        className="mt-6 flex gap-2"
      >
        <input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="New category name"
          className="rounded border p-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          Add category
        </button>
      </form>
    </div>
  )
}

function MenuCategorySection({
  truckId,
  slug,
  category,
  onMutate,
  isPending,
}: {
  truckId: string
  slug: string
  category: MenuCategoryView
  onMutate: (action: () => Promise<void>) => void
  isPending: boolean
}) {
  const [isAddingItem, setIsAddingItem] = useState(false)

  return (
    <section className="mt-6 border-t pt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{category.name}</h3>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onMutate(() => deleteMenuCategoryAction(truckId, slug, category.id))}
          className="text-xs text-red-600 disabled:opacity-50"
        >
          Delete category
        </button>
      </div>

      <ul className="mt-2 space-y-2">
        {category.items.map((item) => (
          <MenuItemRow
            key={item.id}
            truckId={truckId}
            slug={slug}
            item={item}
            onMutate={onMutate}
            isPending={isPending}
          />
        ))}
      </ul>

      {isAddingItem ? (
        <MenuItemForm
          submitLabel="Add item"
          onCancel={() => setIsAddingItem(false)}
          onSubmit={(input) =>
            onMutate(async () => {
              await createMenuItemAction(truckId, slug, category.id, input)
              setIsAddingItem(false)
            })
          }
        />
      ) : (
        <button type="button" onClick={() => setIsAddingItem(true)} className="mt-2 text-sm underline">
          + Add item
        </button>
      )}
    </section>
  )
}

function MenuItemRow({
  truckId,
  slug,
  item,
  onMutate,
  isPending,
}: {
  truckId: string
  slug: string
  item: MenuItemView
  onMutate: (action: () => Promise<void>) => void
  isPending: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return (
      <li>
        <MenuItemForm
          initial={item}
          submitLabel="Save"
          onCancel={() => setIsEditing(false)}
          onSubmit={(input) =>
            onMutate(async () => {
              await updateMenuItemAction(truckId, slug, item.id, input)
              setIsEditing(false)
            })
          }
        />
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between text-sm">
      <span>
        {item.name}
        {!item.isAvailable && <span className="ml-2 text-gray-400">(unavailable)</span>}
      </span>
      <span className="flex gap-2">
        <button type="button" onClick={() => setIsEditing(true)} className="underline">
          Edit
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onMutate(() => deleteMenuItemAction(truckId, slug, item.id))}
          className="text-red-600 disabled:opacity-50"
        >
          Delete
        </button>
      </span>
    </li>
  )
}

function MenuItemForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial?: MenuItemView
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: MenuItemInput) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [price, setPrice] = useState(initial?.price?.toString() ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '')
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true)
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false)
  const [dietaryFlags, setDietaryFlags] = useState(initial?.dietaryFlags.join(', ') ?? '')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        onSubmit({
          name: name.trim(),
          description: description.trim() || null,
          price: price.trim() ? Number(price) : null,
          imageUrl: imageUrl.trim() || null,
          isAvailable,
          isFeatured,
          dietaryFlags: dietaryFlags
            .split(',')
            .map((f) => f.trim())
            .filter(Boolean),
        })
      }}
      className="mt-2 space-y-2 rounded border p-3"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="w-full rounded border p-1 text-sm"
        required
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        className="w-full rounded border p-1 text-sm"
      />
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Price (dollars, e.g. 4.50)"
        inputMode="decimal"
        className="w-full rounded border p-1 text-sm"
      />
      <ImageUploadField label="Photo" value={imageUrl || null} onChange={setImageUrl} />
      <input
        value={dietaryFlags}
        onChange={(e) => setDietaryFlags(e.target.value)}
        placeholder="Dietary flags (comma-separated)"
        className="w-full rounded border p-1 text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
        Available
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
        Featured
      </label>
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-gray-900 px-3 py-1 text-sm text-white">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="text-sm underline">
          Cancel
        </button>
      </div>
    </form>
  )
}
