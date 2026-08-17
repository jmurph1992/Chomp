import Link from 'next/link'
import Image from 'next/image'
import type { FeedItem, TruckEventView } from '@chomp/types'
import { timeAgo } from '@chomp/utils'
import { getFeedPage, parsePageParam } from '@/lib/feed'
import { getUpcomingEventsForFeed } from '@/lib/events'

const FEED_EVENTS_LIMIT = 10

function formatEventDateTime(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = parsePageParam(pageParam)
  // Queried live on every request, deliberately not part of feed_items —
  // that materialized view only refreshes once a day, too stale for a
  // same-day event announcement. See lib/events.ts#getUpcomingEventsForFeed.
  const [{ items, hasMore }, upcomingEvents] = await Promise.all([
    getFeedPage(page),
    getUpcomingEventsForFeed(FEED_EVENTS_LIMIT),
  ])

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Feed</h1>
      <p className="mt-1 text-gray-500">Recent highly-rated reviews and popular photos.</p>

      {upcomingEvents.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold">Upcoming Events</h2>
          <ul className="mt-2 space-y-3">
            {upcomingEvents.map((event) => (
              <FeedEventCard key={event.id} event={event} />
            ))}
          </ul>
        </section>
      )}

      {items.length === 0 ? (
        <p className="mt-6 text-gray-500">No recent activity yet.</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {items.map((item) => (
            <FeedItemCard key={item.itemId} item={item} />
          ))}
        </ul>
      )}

      <div className="mt-6 flex justify-between text-sm">
        {page > 1 ? (
          <Link href={`/feed?page=${page - 1}`} className="underline">
            Previous
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link href={`/feed?page=${page + 1}`} className="underline">
            Next
          </Link>
        )}
      </div>
    </main>
  )
}

function FeedEventCard({
  event,
}: {
  event: TruckEventView & { truckSlug: string; truckName: string }
}) {
  const start = formatEventDateTime(event.startsAt)
  const end = formatEventDateTime(event.endsAt)

  return (
    <li className="border-t pt-4 text-sm">
      <Link href={`/trucks/${event.truckSlug}`} className="font-medium text-gray-900">
        {event.truckName}
      </Link>
      <p className="mt-1 font-medium">{event.title}</p>
      {(start || end) && (
        <p className="text-gray-500">
          {start ?? '—'}
          {end ? ` – ${end}` : ''}
        </p>
      )}
      {event.address && <p className="text-gray-500">{event.address}</p>}
    </li>
  )
}

function FeedItemCard({ item }: { item: FeedItem }) {
  return (
    <li className="border-t pt-4">
      <div className="flex items-baseline gap-2 text-sm text-gray-500">
        <Link href={`/trucks/${item.truckSlug}`} className="font-medium text-gray-900">
          {item.truckName}
        </Link>
        <span>{item.authorDisplayName ?? 'Anonymous'}</span>
        <span>{timeAgo(item.createdAt)}</span>
      </div>

      {item.type === 'review' && item.rating !== null && (
        <p className="mt-1 text-sm text-gray-500">{item.rating} ★</p>
      )}

      {item.imageUrl && (
        <Image
          src={item.imageUrl}
          alt={item.content ?? item.truckName}
          width={400}
          height={300}
          unoptimized
          className="mt-2 max-h-80 w-full rounded object-cover"
        />
      )}

      {item.content && <p className="mt-2 text-sm">{item.content}</p>}
    </li>
  )
}
