import Image from 'next/image'
import Link from 'next/link'
import type { MyReviewView } from '@chomp/types'

/**
 * Read-only — editing/deleting a review still happens on the truck's own
 * page (upsertReview/deleteReview). This is just "here's everything you've
 * written," including reviews whose truck has since been deleted.
 */
export function MyReviews({ reviews }: { reviews: MyReviewView[] }) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        You haven&apos;t written any reviews yet.{' '}
        <Link href="/" className="underline">
          Find a truck
        </Link>
        .
      </p>
    )
  }

  return (
    <ul className="space-y-4">
      {reviews.map((review) => (
        <li key={review.id} className="border-t pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-gray-500">{review.rating} ★</span>
            <span className="text-xs text-gray-400">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
          {review.body && <p className="mt-1 text-sm">{review.body}</p>}
          {review.photo && (
            <div className="mt-2">
              <Image
                src={review.photo.url}
                alt={review.photo.caption ?? ''}
                width={120}
                height={120}
                unoptimized
                className="h-24 w-24 rounded object-cover"
              />
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 text-sm">
            {review.truckSlug ? (
              <Link href={`/trucks/${review.truckSlug}`} className="underline">
                View on {review.truckName} →
              </Link>
            ) : (
              <span className="text-gray-500">{review.truckName ?? 'This truck'} (deleted)</span>
            )}
            {!review.isVisible && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                Hidden by moderator
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
