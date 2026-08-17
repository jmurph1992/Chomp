'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TruckEventInput, TruckEventView } from '@chomp/types'
import { createEventAction, deleteEventAction, updateEventAction } from '@/app/actions/events'

function formatDateTime(iso: string | null): string {
  if (!iso) return 'No date set'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** `datetime-local` inputs want "YYYY-MM-DDTHH:mm" in local time, not a full ISO instant. */
function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function TruckEventsEditor({
  truckId,
  slug,
  events,
}: {
  truckId: string
  slug: string
  events: TruckEventView[]
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

      {events.length === 0 && !isAdding && (
        <p className="text-sm text-gray-500">No events yet.</p>
      )}

      <ul className="space-y-2">
        {events.map((event) => (
          <EventRow
            key={event.id}
            truckId={truckId}
            slug={slug}
            event={event}
            onMutate={run}
            isPending={isPending}
          />
        ))}
      </ul>

      {isAdding ? (
        <EventForm
          submitLabel="Add"
          onCancel={() => setIsAdding(false)}
          onSubmit={(input) =>
            run(async () => {
              await createEventAction(truckId, slug, input)
              setIsAdding(false)
            })
          }
        />
      ) : (
        <button type="button" onClick={() => setIsAdding(true)} className="mt-4 text-sm underline">
          + Add event
        </button>
      )}
    </div>
  )
}

function EventRow({
  truckId,
  slug,
  event,
  onMutate,
  isPending,
}: {
  truckId: string
  slug: string
  event: TruckEventView
  onMutate: (action: () => Promise<void>) => void
  isPending: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return (
      <li>
        <EventForm
          initial={event}
          submitLabel="Save"
          onCancel={() => setIsEditing(false)}
          onSubmit={(input) =>
            onMutate(async () => {
              await updateEventAction(truckId, slug, event.id, input)
              setIsEditing(false)
            })
          }
        />
      </li>
    )
  }

  return (
    <li className="flex items-center justify-between text-sm">
      <span>
        <strong>{event.title}</strong> — {formatDateTime(event.startsAt)}
        {event.endsAt ? ` – ${formatDateTime(event.endsAt)}` : ''}
        {event.address ? ` @ ${event.address}` : ''}
      </span>
      <span className="flex gap-2">
        <button type="button" onClick={() => setIsEditing(true)} className="underline">
          Edit
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onMutate(() => deleteEventAction(truckId, slug, event.id))}
          className="text-red-600 disabled:opacity-50"
        >
          Delete
        </button>
      </span>
    </li>
  )
}

function EventForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial?: TruckEventView
  submitLabel: string
  onCancel: () => void
  onSubmit: (input: TruckEventInput) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [startsAt, setStartsAt] = useState(toDateTimeLocalValue(initial?.startsAt ?? null))
  const [endsAt, setEndsAt] = useState(toDateTimeLocalValue(initial?.endsAt ?? null))
  const [address, setAddress] = useState(initial?.address ?? '')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          title,
          description: description.trim() || null,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          address: address.trim() || null,
        })
      }}
      className="mt-2 space-y-2 rounded border p-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        required
        className="w-full rounded border p-1 text-sm"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full rounded border p-1 text-sm"
      />
      <div className="flex gap-2">
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="rounded border p-1 text-sm"
        />
        <input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          className="rounded border p-1 text-sm"
        />
      </div>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Address (optional — used to place a Get Directions link)"
        className="w-full rounded border p-1 text-sm"
      />

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
