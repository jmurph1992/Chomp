'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { postLocationAction } from '@/app/actions/locations'

type Props = {
  truckId: string
  slug: string
  currentLocation: { address: string | null; reportedAt: string } | null
}

export function TruckLocationForm({ truckId, slug, currentLocation }: Props) {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'posted'>('idle')
  const [isPending, startTransition] = useTransition()

  function useMyLocation() {
    setError(null)
    if (!navigator.geolocation) {
      setError('Geolocation is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setCoords({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setError('Could not get your location — check location permissions.'),
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setStatus('idle')

    if (!coords) {
      setError('Use "Get my current location" first — coordinates are required.')
      return
    }

    startTransition(async () => {
      try {
        await postLocationAction(truckId, slug, {
          lat: coords.lat,
          lng: coords.lng,
          address: address.trim() || null,
        })
        setStatus('posted')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div>
      {currentLocation && (
        <p className="text-sm text-gray-500">
          Current: {currentLocation.address ?? 'no address on file'} (reported{' '}
          {new Date(currentLocation.reportedAt).toLocaleString()})
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 max-w-md space-y-3">
        <button
          type="button"
          onClick={useMyLocation}
          className="rounded border px-3 py-1 text-sm"
        >
          Get my current location
        </button>
        {coords && (
          <p className="text-sm text-gray-500">
            Captured: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
        )}

        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address (optional, shown to customers)"
          className="w-full rounded border p-2 text-sm"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {status === 'posted' && <p className="text-sm text-green-700">Location posted.</p>}

        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Post location
        </button>
      </form>
    </div>
  )
}
