'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTruckAction } from '@/app/actions/trucks'
import { MAX_TRUCK_DESCRIPTION_LENGTH, MAX_TRUCK_NAME_LENGTH } from '@/lib/truck-validation'

export function CreateTruckForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Name is required.')
      return
    }

    startTransition(async () => {
      try {
        const truck = await createTruckAction({
          name: name.trim(),
          description: description.trim() || null,
          cuisineType: cuisine
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
        })
        router.push(`/dashboard/${truck.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium">Truck name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_TRUCK_NAME_LENGTH}
          className="mt-1 w-full rounded border p-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_TRUCK_DESCRIPTION_LENGTH}
          rows={3}
          className="mt-1 w-full rounded border p-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Cuisine (comma-separated)</label>
        <input
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
          placeholder="mexican, fusion"
          className="mt-1 w-full rounded border p-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        Create truck
      </button>
    </form>
  )
}
