'use client'

import { useState, useTransition } from 'react'
import type { AdminTruckView, VerificationStatusValue } from '@chomp/types'
import { holdTruckAction, rejectTruckAction, verifyTruckAction } from '@/app/actions/admin'

const STATUS_LABEL: Record<VerificationStatusValue, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
  onHold: 'On hold',
}

export function AdminTruckQueue({ trucks }: { trucks: AdminTruckView[] }) {
  if (trucks.length === 0) {
    return <p className="mt-6 text-gray-500">No trucks yet.</p>
  }

  return (
    <ul className="mt-6 space-y-4">
      {trucks.map((truck) => (
        <TruckRow key={truck.id} truck={truck} />
      ))}
    </ul>
  )
}

type ReasonAction = (truckId: string, slug: string, reason: string) => Promise<void>

function TruckRow({ truck }: { truck: AdminTruckView }) {
  const [isPending, startTransition] = useTransition()
  const [reasonMode, setReasonMode] = useState<'reject' | 'hold' | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function runReasonAction(action: ReasonAction) {
    setError(null)
    startTransition(async () => {
      try {
        await action(truck.id, truck.slug, reason)
        setReasonMode(null)
        setReason('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  function verify() {
    setError(null)
    startTransition(async () => {
      try {
        await verifyTruckAction(truck.id, truck.slug)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <li className="border-t pt-4">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-medium">{truck.name}</span>{' '}
          <span className="text-sm text-gray-500">({truck.ownerEmail})</span>
        </div>
        <span className="text-sm text-gray-500">{STATUS_LABEL[truck.verificationStatus]}</span>
      </div>
      {truck.description && <p className="mt-1 text-sm">{truck.description}</p>}
      <p className="mt-1 text-sm text-gray-500">
        {truck.cuisineType.join(', ') || 'No cuisine listed'}
        {truck.phone && ` · ${truck.phone}`}
        {truck.website && ` · ${truck.website}`}
        {truck.instagram && ` · ${truck.instagram}`}
      </p>
      {truck.verificationNote && (
        <p className="mt-1 text-sm text-red-600">Note: {truck.verificationNote}</p>
      )}

      <div className="mt-2 flex items-center gap-3 text-sm">
        {truck.verificationStatus !== 'verified' && (
          <button onClick={verify} disabled={isPending} className="text-green-700 disabled:opacity-50">
            Verify
          </button>
        )}
        {truck.verificationStatus === 'pending' && (
          <button
            onClick={() => setReasonMode('reject')}
            disabled={isPending}
            className="text-red-600 disabled:opacity-50"
          >
            Reject
          </button>
        )}
        {truck.verificationStatus === 'verified' && (
          <button
            onClick={() => setReasonMode('hold')}
            disabled={isPending}
            className="text-amber-700 disabled:opacity-50"
          >
            Put on hold
          </button>
        )}
      </div>

      {reasonMode && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonMode === 'reject' ? 'Reason for rejecting' : 'Reason for holding'}
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
          <button
            onClick={() => runReasonAction(reasonMode === 'reject' ? rejectTruckAction : holdTruckAction)}
            disabled={isPending || !reason.trim()}
            className="text-sm underline disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            onClick={() => {
              setReasonMode(null)
              setReason('')
            }}
            disabled={isPending}
            className="text-sm text-gray-500"
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </li>
  )
}
