'use client'

import { useState, useTransition } from 'react'
import type { ContentReportReasonValue } from '@chomp/types'
import { SignedInSafe } from '@/components/signed-in-safe'

const REASON_OPTIONS: { value: ContentReportReasonValue; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'other', label: 'Other' },
]

/**
 * Shared by both review and photo reports (see TruckReviews). Hidden
 * entirely when the content belongs to the viewer — enforced again
 * server-side in lib/reports.ts regardless, this is just the UI-layer
 * shortcut. No visible report count anywhere — reports are admin-only.
 */
export function ReportButton({
  isOwnContent,
  onSubmit,
}: {
  isOwnContent: boolean
  onSubmit: (reason: ContentReportReasonValue, note: string | null) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState<ContentReportReasonValue>('spam')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'reported'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (isOwnContent || status === 'reported') {
    return status === 'reported' ? <p className="text-xs text-gray-500">Reported — thanks.</p> : null
  }

  return (
    <SignedInSafe>
      {isOpen ? (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ContentReportReasonValue)}
            className="rounded border px-1 py-0.5"
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="rounded border px-1 py-0.5"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null)
                try {
                  await onSubmit(reason, note.trim() || null)
                  setStatus('reported')
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Something went wrong.')
                }
              })
            }
            className="underline disabled:opacity-50"
          >
            Submit
          </button>
          <button type="button" onClick={() => setIsOpen(false)} disabled={isPending} className="text-gray-500">
            Cancel
          </button>
          {error && <span className="text-red-600">{error}</span>}
        </div>
      ) : (
        <button type="button" onClick={() => setIsOpen(true)} className="text-xs text-gray-400 underline">
          Report
        </button>
      )}
    </SignedInSafe>
  )
}
