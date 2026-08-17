'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ScheduleEntryInput, TruckScheduleEntry } from '@chomp/types'
import {
  createScheduleEntryAction,
  deleteScheduleEntryAction,
  updateScheduleEntryAction,
} from '@/app/actions/schedule'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * The stored value is a literal wall-clock reading (see ScheduleForm's
 * onSubmit below), never a real instant — timeZone: 'UTC' means "read back
 * exactly what was typed," regardless of the server/browser's own local
 * timezone.
 */
function formatTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
}

export function TruckScheduleEditor({
  truckId,
  slug,
  schedule,
}: {
  truckId: string
  slug: string
  schedule: TruckScheduleEntry[]
}) {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
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

      <ul className="space-y-2">
        {schedule.map((entry) => (
          <ScheduleRow
            key={entry.id}
            truckId={truckId}
            slug={slug}
            entry={entry}
            onMutate={run}
            isPending={isPending}
          />
        ))}
      </ul>

      {isAdding ? (
        <ScheduleForm
          submitLabel="Add"
          onCancel={() => setIsAdding(false)}
          onSubmit={(input) =>
            run(async () => {
              await createScheduleEntryAction(truckId, slug, input)
              setIsAdding(false)
            })
          }
        />
      ) : (
        <button type="button" onClick={() => setIsAdding(true)} className="mt-4 text-sm underline">
          + Add schedule entry
        </button>
      )}
    </div>
  )
}

function ScheduleRow({
  truckId,
  slug,
  entry,
  onMutate,
  isPending,
}: {
  truckId: string
  slug: string
  entry: TruckScheduleEntry
  onMutate: (action: () => Promise<void>) => void
  isPending: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return (
      <li>
        <ScheduleForm
          initial={entry}
          submitLabel="Save"
          onCancel={() => setIsEditing(false)}
          onSubmit={(input) =>
            onMutate(async () => {
              await updateScheduleEntryAction(truckId, slug, entry.id, input)
              setIsEditing(false)
            })
          }
        />
      </li>
    )
  }

  const when =
    entry.specificDate !== null
      ? new Date(entry.specificDate).toLocaleDateString()
      : entry.dayOfWeek !== null
        ? DAY_NAMES[entry.dayOfWeek]
        : '—'

  return (
    <li className="flex items-center justify-between text-sm">
      <span>
        {when}: {formatTime(entry.startTime)} – {formatTime(entry.endTime)}
        {entry.locationNote ? ` @ ${entry.locationNote}` : ''}
        {entry.isCancelled && <span className="ml-2 text-gray-400">(cancelled)</span>}
      </span>
      <span className="flex gap-2">
        <button type="button" onClick={() => setIsEditing(true)} className="underline">
          Edit
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onMutate(() => deleteScheduleEntryAction(truckId, slug, entry.id))}
          className="text-red-600 disabled:opacity-50"
        >
          Delete
        </button>
      </span>
    </li>
  )
}

function ScheduleForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial?: TruckScheduleEntry
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: ScheduleEntryInput) => void
}) {
  const [mode, setMode] = useState<'weekly' | 'specific'>(
    initial?.specificDate ? 'specific' : 'weekly',
  )
  const [dayOfWeek, setDayOfWeek] = useState(initial?.dayOfWeek ?? 0)
  const [specificDate, setSpecificDate] = useState(initial?.specificDate?.slice(0, 10) ?? '')
  const [startTime, setStartTime] = useState(initial?.startTime?.slice(11, 16) ?? '11:00')
  const [endTime, setEndTime] = useState(initial?.endTime?.slice(11, 16) ?? '14:00')
  const [locationNote, setLocationNote] = useState(initial?.locationNote ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [isCancelled, setIsCancelled] = useState(initial?.isCancelled ?? false)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          dayOfWeek: mode === 'weekly' ? dayOfWeek : null,
          specificDate: mode === 'specific' && specificDate ? `${specificDate}T00:00:00.000Z` : null,
          startTime: startTime ? `1970-01-01T${startTime}:00.000Z` : null,
          endTime: endTime ? `1970-01-01T${endTime}:00.000Z` : null,
          locationNote: locationNote.trim() || null,
          address: address.trim() || null,
          isCancelled,
        })
      }}
      className="mt-2 space-y-2 rounded border p-3"
    >
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === 'weekly'}
            onChange={() => setMode('weekly')}
          />
          Weekly
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={mode === 'specific'}
            onChange={() => setMode('specific')}
          />
          One-off date
        </label>
      </div>

      {mode === 'weekly' ? (
        <select
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(Number(e.target.value))}
          className="rounded border p-1 text-sm"
        >
          {DAY_NAMES.map((day, i) => (
            <option key={day} value={i}>
              {day}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="date"
          value={specificDate}
          onChange={(e) => setSpecificDate(e.target.value)}
          className="rounded border p-1 text-sm"
        />
      )}

      <div className="flex gap-2">
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="rounded border p-1 text-sm"
        />
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="rounded border p-1 text-sm"
        />
      </div>

      <input
        value={locationNote}
        onChange={(e) => setLocationNote(e.target.value)}
        placeholder="Location note (e.g. Corner of 5th and Main)"
        className="w-full rounded border p-1 text-sm"
      />
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address"
        className="w-full rounded border p-1 text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isCancelled} onChange={(e) => setIsCancelled(e.target.checked)} />
        Cancelled
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
