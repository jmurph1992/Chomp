import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getTruckBySlug } from '@/lib/trucks'
import { getTodaysScheduleEntries } from '@/lib/schedule'
import { getCurrentUser } from '@/lib/auth'
import {
  canModerateReviews,
  getOwnReview,
  getReviewSummary,
  getVisibleReviewsForTruck,
} from '@/lib/reviews'
import { TruckMenu } from '@/components/truck-menu'
import { TruckReviews } from '@/components/truck-reviews'

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

  const currentUser = await getCurrentUser()
  const [reviews, reviewSummary, ownReview] = await Promise.all([
    getVisibleReviewsForTruck(truck.id, currentUser?.id),
    getReviewSummary(truck.id),
    currentUser ? getOwnReview(truck.id, currentUser.id) : Promise.resolve(null),
  ])

  return (
    <main className="mx-auto max-w-2xl p-8">
      {truck.coverUrl && (
        <Image
          src={truck.coverUrl}
          alt=""
          width={800}
          height={300}
          unoptimized
          className="mb-4 h-48 w-full rounded object-cover"
        />
      )}
      <div className="flex items-center gap-3">
        {truck.logoUrl && (
          <Image
            src={truck.logoUrl}
            alt=""
            width={56}
            height={56}
            unoptimized
            className="h-14 w-14 rounded-full object-cover"
          />
        )}
        <h1 className="text-3xl font-bold">{truck.name}</h1>
        {/* getTruckBySlug only ever returns verified trucks (see lib/trucks.ts) — every
            truck that reaches this page is verified, so the badge is unconditional. */}
        <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
          Verified
        </span>
      </div>
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

      <TruckReviews
        truckId={truck.id}
        slug={truck.slug}
        reviews={reviews}
        summary={reviewSummary}
        ownReview={ownReview}
        isAdmin={canModerateReviews(currentUser?.role)}
      />
    </main>
  )
}
