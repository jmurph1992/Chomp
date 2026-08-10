'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteTruckAction } from '@/app/actions/trucks'

/**
 * The strongest confirmation gate in this dashboard — typing the truck's
 * exact name, not just a click-through Confirm/Cancel — proportionate to
 * this being the one truly irreversible action in the app.
 */
export function DeleteTruckSection({ truckId, truckName }: { truckId: string; truckName: string }) {
  const router = useRouter()
  const [typedName, setTypedName] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const canDelete = typedName.trim() === truckName

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteTruckAction(truckId, typedName)
        router.push('/dashboard')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <section className="mt-8 max-w-md rounded border border-red-200 p-4">
      <h2 className="font-medium text-red-700">Danger zone</h2>
      <p className="mt-1 text-sm text-gray-500">
        Deleting this truck is permanent. Its menu, schedule, and location history are removed;
        managers lose access; customer reviews and photos are kept but detached, and won&apos;t be
        shown anywhere again.
      </p>
      <label className="mt-3 block text-sm font-medium">
        Type <span className="font-mono">{truckName}</span> to confirm
      </label>
      <input
        value={typedName}
        onChange={(e) => setTypedName(e.target.value)}
        className="mt-1 w-full rounded border p-2 text-sm"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        onClick={handleDelete}
        disabled={!canDelete || isPending}
        className="mt-3 rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        Delete this truck
      </button>
    </section>
  )
}
