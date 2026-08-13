'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { expiresAtForPreset, isLocationActive, type DurationPresetId } from '@chomp/utils'
import { postLocationAction, extendLocationAction } from '@/app/actions/locations'
import { LocationStatus } from '@/components/location-status'
import { LocationDurationPicker } from '@/components/dashboard/location-duration-picker'

type Props = {
  truckId: string
  slug: string
  currentLocation: { address: string | null; reportedAt: string; expiresAt: string | null } | null
}

export function TruckLocationForm({ truckId, slug, currentLocation }: Props) {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<DurationPresetId | null>(null)
  const [extendPreset, setExtendPreset] = useState<DurationPresetId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'posted' | 'extended'>('idle')
  const [isPending, startTransition] = useTransition()

  const canExtend = currentLocation && isLocationActive(currentLocation.expiresAt)

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
    if (!selectedPreset) {
      setError('Select how long you\'ll be here.')
      return
    }

    startTransition(async () => {
      try {
        await postLocationAction(truckId, slug, {
          lat: coords.lat,
          lng: coords.lng,
          address: address.trim() || null,
          expiresAt: expiresAtForPreset(selectedPreset).toISOString(),
        })
        setStatus('posted')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  function handleExtend() {
    setError(null)
    setStatus('idle')

    if (!extendPreset) {
      setError('Select how much longer you\'ll be here.')
      return
    }

    startTransition(async () => {
      try {
        await extendLocationAction(truckId, slug, expiresAtForPreset(extendPreset).toISOString())
        setStatus('extended')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div>
      {currentLocation && (
        <div className="space-y-1">
          <p className="text-sm text-gray-500">
            {currentLocation.address ?? 'no address on file'} (reported{' '}
            {new Date(currentLocation.reportedAt).toLocaleString()})
          </p>
          <LocationStatus reportedAt={currentLocation.reportedAt} expiresAt={currentLocation.expiresAt} />
        </div>
      )}

      {canExtend && (
        <div className="mt-4 max-w-md space-y-3 rounded border p-3">
          <p className="text-sm font-medium">Still here? Extend without re-sharing your location.</p>
          <LocationDurationPicker value={extendPreset} onChange={setExtendPreset} />
          <button
            type="button"
            onClick={handleExtend}
            disabled={isPending}
            className="rounded border px-4 py-2 text-sm disabled:opacity-50"
          >
            Extend
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 max-w-md space-y-3">
        <button type="button" onClick={useMyLocation} className="rounded border px-3 py-1 text-sm">
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

        <div>
          <p className="mb-1 text-sm font-medium">How long will you be here?</p>
          <LocationDurationPicker value={selectedPreset} onChange={setSelectedPreset} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {status === 'posted' && <p className="text-sm text-green-700">Location posted.</p>}
        {status === 'extended' && <p className="text-sm text-green-700">Extended.</p>}

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
