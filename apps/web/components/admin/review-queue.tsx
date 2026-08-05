'use client'

import { useMemo, useState, useTransition } from 'react'
import type { AdminReviewView } from '@chomp/types'
import { hideReviewAction, unhideReviewAction } from '@/app/actions/admin'

type Filter = 'all' | 'hidden' | 'visible'

export function AdminReviewQueue({ reviews }: { reviews: AdminReviewView[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    if (filter === 'hidden') return reviews.filter((r) => !r.isVisible)
    if (filter === 'visible') return reviews.filter((r) => r.isVisible)
    return reviews
  }, [filter, reviews])

  return (
    <div>
      <div className="mt-4 flex gap-3 text-sm">
        {(['all', 'hidden', 'visible'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={
              filter === value ? 'font-medium underline' : 'text-gray-500 hover:underline'
            }
          >
            {value === 'all' ? 'All' : value === 'hidden' ? 'Hidden' : 'Visible'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-gray-500">No reviews here.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {filtered.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </ul>
      )}
    </div>
  )
}

type ReasonAction = (reviewId: string, slug: string, reason: string) => Promise<void>

function ReviewRow({ review }: { review: AdminReviewView }) {
  const [isPending, startTransition] = useTransition()
  const [reasonMode, setReasonMode] = useState<'hide' | 'unhide' | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function runReasonAction(action: ReasonAction) {
    setError(null)
    startTransition(async () => {
      try {
        await action(review.id, review.truckSlug, reason)
        setReasonMode(null)
        setReason('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <li className="border-t pt-4">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-medium">{review.truckName}</span>{' '}
          <span className="text-sm text-gray-500">
            {review.userDisplayName ?? 'Anonymous'} ({review.userEmail}) · {review.rating} ★
          </span>
        </div>
        <span className="text-sm text-gray-500">{review.isVisible ? 'Visible' : 'Hidden'}</span>
      </div>
      {review.body && <p className="mt-1 text-sm">{review.body}</p>}
      {review.moderationNote && (
        <p className="mt-1 text-sm text-red-600">
          Note: {review.moderationNote}
          {review.moderatedByEmail && ` — ${review.moderatedByEmail}`}
          {review.moderatedAt && ` (${new Date(review.moderatedAt).toLocaleString()})`}
        </p>
      )}

      <div className="mt-2 flex items-center gap-3 text-sm">
        {review.isVisible ? (
          <button
            onClick={() => setReasonMode('hide')}
            disabled={isPending}
            className="text-red-600 disabled:opacity-50"
          >
            Hide
          </button>
        ) : (
          <button
            onClick={() => setReasonMode('unhide')}
            disabled={isPending}
            className="text-green-700 disabled:opacity-50"
          >
            Unhide
          </button>
        )}
      </div>

      {reasonMode && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonMode === 'hide' ? 'Reason for hiding' : 'Reason for unhiding'}
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
          <button
            onClick={() => runReasonAction(reasonMode === 'hide' ? hideReviewAction : unhideReviewAction)}
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
