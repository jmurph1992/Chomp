import type { TruckEventView } from '@chomp/types'
import { buildDirectionsUrl } from '@chomp/utils'

function formatDateTime(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/** No section at all with zero upcoming events — same "hide empty state" convention menu categories already follow. */
export function TruckEvents({ events }: { events: TruckEventView[] }) {
  if (events.length === 0) return null

  return (
    <section className="mt-6">
      <h2 className="text-xl font-semibold">Upcoming Events</h2>
      <ul className="mt-2 space-y-3">
        {events.map((event) => {
          const directionsUrl = buildDirectionsUrl(event.address, event.lat, event.lng)
          const start = formatDateTime(event.startsAt)
          const end = formatDateTime(event.endsAt)

          return (
            <li key={event.id} className="text-sm">
              <p className="font-medium">{event.title}</p>
              {(start || end) && (
                <p className="text-gray-500">
                  {start ?? '—'}
                  {end ? ` – ${end}` : ''}
                </p>
              )}
              {event.description && <p className="mt-1">{event.description}</p>}
              {event.address && <p className="text-gray-500">{event.address}</p>}
              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-blue-600 underline"
                >
                  Get Directions
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
