'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import type { ContentReportView } from '@chomp/types'
import { dismissContentReportAction, resolveContentReportAction } from '@/app/actions/admin'

type Filter = 'open' | 'resolved' | 'dismissed' | 'all'

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  inappropriate: 'Inappropriate',
  harassment: 'Harassment',
  other: 'Other',
}

export function AdminReportQueue({ reports }: { reports: ContentReportView[] }) {
  const [filter, setFilter] = useState<Filter>('open')

  const filtered = useMemo(() => {
    if (filter === 'all') return reports
    return reports.filter((r) => r.status === filter)
  }, [filter, reports])

  return (
    <div>
      <div className="mt-4 flex gap-3 text-sm">
        {(['open', 'resolved', 'dismissed', 'all'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={filter === value ? 'font-medium underline' : 'text-gray-500 hover:underline'}
          >
            {value === 'all' ? 'All' : value[0]!.toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-gray-500">No reports here.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {filtered.map((report) => (
            <ReportRow key={report.id} report={report} />
          ))}
        </ul>
      )}
    </div>
  )
}

type ReasonAction = (reportId: string, resolutionNote: string) => Promise<void>

function ReportRow({ report }: { report: ContentReportView }) {
  const [isPending, startTransition] = useTransition()
  const [reasonMode, setReasonMode] = useState<'resolve' | 'dismiss' | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function runReasonAction(action: ReasonAction) {
    setError(null)
    startTransition(async () => {
      try {
        await action(report.id, resolutionNote)
        setReasonMode(null)
        setResolutionNote('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <li className="border-t pt-4">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-medium">{report.truckName}</span>{' '}
          <span className="text-sm text-gray-500">
            {REASON_LABELS[report.reason] ?? report.reason} · {report.reporterEmail ?? 'Deleted user'}
          </span>
        </div>
        <span className="text-sm text-gray-500 capitalize">{report.status}</span>
      </div>

      {report.note && <p className="mt-1 text-sm text-gray-500">Reporter note: {report.note}</p>}

      {report.review && (
        <p className="mt-1 text-sm">
          {report.review.rating} ★ {report.review.body}
        </p>
      )}
      {report.reviewPhoto && (
        <div className="mt-2">
          <Image
            src={report.reviewPhoto.url}
            alt={report.reviewPhoto.caption ?? ''}
            width={120}
            height={120}
            unoptimized
            className="h-24 w-24 rounded object-cover"
          />
          {report.reviewPhoto.caption && (
            <p className="mt-1 text-xs text-gray-500">{report.reviewPhoto.caption}</p>
          )}
        </div>
      )}

      {report.resolutionNote && (
        <p className="mt-1 text-sm text-red-600">
          Resolution: {report.resolutionNote}
          {report.resolvedByEmail && ` — ${report.resolvedByEmail}`}
          {report.resolvedAt && ` (${new Date(report.resolvedAt).toLocaleString()})`}
        </p>
      )}

      {report.status === 'open' && (
        <div className="mt-2 flex items-center gap-3 text-sm">
          <button
            onClick={() => setReasonMode('resolve')}
            disabled={isPending}
            className="text-red-600 disabled:opacity-50"
          >
            Resolve (hide content)
          </button>
          <button
            onClick={() => setReasonMode('dismiss')}
            disabled={isPending}
            className="text-gray-500 disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      )}

      {reasonMode && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder={reasonMode === 'resolve' ? 'Reason for hiding' : 'Reason for dismissing'}
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
          <button
            onClick={() =>
              runReasonAction(reasonMode === 'resolve' ? resolveContentReportAction : dismissContentReportAction)
            }
            disabled={isPending || !resolutionNote.trim()}
            className="text-sm underline disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            onClick={() => {
              setReasonMode(null)
              setResolutionNote('')
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
