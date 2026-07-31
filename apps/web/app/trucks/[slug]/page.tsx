import { notFound } from 'next/navigation'
import { getTruckBySlug } from '@/lib/trucks'
import { getTodaysScheduleEntries } from '@/lib/schedule'
import { TruckMenu } from '@/components/truck-menu'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export default async function TruckDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const truck = await getTruckBySlug(slug)
  if (!truck) notFound()

  const todaysSchedule = getTodaysScheduleEntries(truck.schedule)

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">{truck.name}</h1>
      {truck.cuisineType.length > 0 && (
        <p className="mt-1 text-gray-500">{truck.cuisineType.join(', ')}</p>
      )}
      {truck.description && <p className="mt-4">{truck.description}</p>}
      {truck.currentAddress && (
        <p className="mt-4">
          <strong>Current location:</strong> {truck.currentAddress}
        </p>
      )}

      {todaysSchedule.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold">Today</h2>
          <ul className="mt-2 space-y-1">
            {todaysSchedule.map((entry) => (
              <li key={entry.id}>
                {formatTime(entry.startTime) ?? '—'} – {formatTime(entry.endTime) ?? '—'}
                {entry.locationNote ? ` @ ${entry.locationNote}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      {truck.schedule.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold">Weekly schedule</h2>
          <ul className="mt-2 space-y-1">
            {truck.schedule
              .filter((entry) => entry.dayOfWeek !== null)
              .map((entry) => (
                <li key={entry.id}>
                  {DAY_NAMES[entry.dayOfWeek!]}: {formatTime(entry.startTime) ?? '—'} –{' '}
                  {formatTime(entry.endTime) ?? '—'}
                </li>
              ))}
          </ul>
        </section>
      )}

      <TruckMenu menu={truck.menu} />
    </main>
  )
}
