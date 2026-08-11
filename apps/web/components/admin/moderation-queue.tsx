'use client'

import { useState, useTransition } from 'react'
import type { ModerationQueueEntryView } from '@chomp/types'
import {
  adminDeleteTruckAction,
  adminReassignTruckOwnerAction,
  dismissModerationEntryAction,
  resolveModerationEntryAction,
} from '@/app/actions/admin-users'

export function AdminModerationQueue({ entries }: { entries: ModerationQueueEntryView[] }) {
  return (
    <ul className="mt-6 space-y-6">
      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} />
      ))}
    </ul>
  )
}

function EntryRow({ entry }: { entry: ModerationQueueEntryView }) {
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<'resolve' | 'dismiss' | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const canResolve = entry.blockingTrucks.length === 0

  function runFinalAction(kind: 'resolve' | 'dismiss') {
    setError(null)
    startTransition(async () => {
      try {
        const fn = kind === 'resolve' ? resolveModerationEntryAction : dismissModerationEntryAction
        await fn(entry.id, note)
        setAction(null)
        setNote('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <li className="rounded border p-4">
      <div>
        <span className="font-medium">{entry.subjectDisplayName ?? 'No name'}</span>{' '}
        <span className="text-sm text-gray-500">{entry.subjectEmail}</span>
      </div>
      {entry.note && <p className="mt-1 text-sm text-gray-500">{entry.note}</p>}
      <p className="mt-1 text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</p>

      <div className="mt-3 space-y-2">
        {entry.blockingTrucks.length === 0 ? (
          <p className="text-sm text-green-700">No blocking trucks remain — ready to resolve.</p>
        ) : (
          entry.blockingTrucks.map((truck) => <BlockingTruckRow key={truck.id} truck={truck} />)
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 text-sm">
        <button
          onClick={() => setAction('resolve')}
          disabled={!canResolve || isPending}
          className="text-red-600 disabled:opacity-50"
          title={canResolve ? undefined : 'Clear every blocking truck first'}
        >
          Resolve (completes deletion)
        </button>
        <button onClick={() => setAction('dismiss')} disabled={isPending} className="text-gray-700 disabled:opacity-50">
          Dismiss (restores account)
        </button>
      </div>

      {action && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Resolution note"
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
          <button
            onClick={() => runFinalAction(action)}
            disabled={isPending || !note.trim()}
            className="text-sm underline disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            onClick={() => {
              setAction(null)
              setNote('')
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

function BlockingTruckRow({ truck }: { truck: ModerationQueueEntryView['blockingTrucks'][number] }) {
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<'delete' | 'reassign' | null>(null)
  const [typedName, setTypedName] = useState('')
  const [reassignTo, setReassignTo] = useState('')
  const [error, setError] = useState<string | null>(null)

  function runDelete() {
    setError(null)
    startTransition(async () => {
      try {
        await adminDeleteTruckAction(truck.id, typedName)
        setMode(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  function runReassign() {
    setError(null)
    startTransition(async () => {
      try {
        await adminReassignTruckOwnerAction(truck.id, reassignTo)
        setMode(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div className="rounded bg-gray-50 p-2">
      <div className="flex items-center justify-between text-sm">
        <span>{truck.name}</span>
        {!mode && (
          <div className="flex gap-3">
            {truck.managers.length > 0 && (
              <button onClick={() => setMode('reassign')} disabled={isPending} className="text-blue-600 disabled:opacity-50">
                Reassign
              </button>
            )}
            <button onClick={() => setMode('delete')} disabled={isPending} className="text-red-600 disabled:opacity-50">
              Delete truck
            </button>
          </div>
        )}
      </div>

      {mode === 'delete' && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={`Type ${truck.name} to confirm`}
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
          <button
            onClick={runDelete}
            disabled={isPending || typedName.trim() !== truck.name}
            className="text-sm text-red-600 underline disabled:opacity-50"
          >
            Confirm
          </button>
          <button onClick={() => setMode(null)} disabled={isPending} className="text-sm text-gray-500">
            Cancel
          </button>
        </div>
      )}

      {mode === 'reassign' && (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={reassignTo}
            onChange={(e) => setReassignTo(e.target.value)}
            className="flex-1 rounded border px-2 py-1 text-sm"
          >
            <option value="">Choose a manager</option>
            {truck.managers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName ?? m.email} ({m.email})
              </option>
            ))}
          </select>
          <button
            onClick={runReassign}
            disabled={isPending || !reassignTo}
            className="text-sm text-blue-600 underline disabled:opacity-50"
          >
            Confirm
          </button>
          <button onClick={() => setMode(null)} disabled={isPending} className="text-sm text-gray-500">
            Cancel
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}
