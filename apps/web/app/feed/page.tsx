import Link from 'next/link'
import Image from 'next/image'
import type { FeedItem } from '@chomp/types'
import { timeAgo } from '@chomp/utils'
import { getFeedPage, parsePageParam } from '@/lib/feed'

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = parsePageParam(pageParam)
  const { items, hasMore } = await getFeedPage(page)

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Feed</h1>
      <p className="mt-1 text-gray-500">Recent highly-rated reviews and popular photos.</p>

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
