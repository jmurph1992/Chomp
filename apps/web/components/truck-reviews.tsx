'use client'

import { useState, useTransition } from 'react'
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs'
import type { ReviewSummary, ReviewView } from '@chomp/types'
import { isValidRating } from '@chomp/utils'
import {
  deleteReviewAction,
  setReviewVisibilityAction,
  submitReviewAction,
} from '@/app/actions/reviews'
import { MAX_REVIEW_BODY_LENGTH, isValidReviewBody } from '@/lib/reviews'

type Props = {
  truckId: string
  slug: string
  reviews: ReviewView[]
  summary: ReviewSummary
  ownReview: ReviewView | null
  isAdmin: boolean
}

export function TruckReviews({ truckId, slug, reviews, summary, ownReview, isAdmin }: Props) {
  return (
    <section className="mt-6">
      <h2 className="text-xl font-semibold">Reviews</h2>
      {summary.reviewCount > 0 ? (
        <p className="mt-1 text-gray-500">
          {summary.averageRating!.toFixed(1)} ★ ({summary.reviewCount} review
          {summary.reviewCount === 1 ? '' : 's'})
        </p>
      ) : (
        <p className="mt-1 text-gray-500">No reviews yet.</p>
      )}

      <SignedOut>
        <p className="mt-4 text-gray-500">
          <SignInButton mode="modal">Sign in</SignInButton> to write a review.
        </p>
      </SignedOut>
      <SignedIn>
        <ReviewForm truckId={truckId} slug={slug} ownReview={ownReview} />
      </SignedIn>

      <ul className="mt-6 space-y-4">
        {reviews.map((review) => (
          <li key={review.id} className="border-t pt-4">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{review.userDisplayName ?? 'Anonymous'}</span>
              <span className="text-gray-500">{review.rating} ★</span>
            </div>
            {review.body && <p className="mt-1 text-sm">{review.body}</p>}
            {isAdmin && <HideReviewButton reviewId={review.id} slug={slug} />}
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReviewForm({
  truckId,
  slug,
  ownReview,
}: {
  truckId: string
  slug: string
  ownReview: ReviewView | null
}) {
  const [rating, setRating] = useState(ownReview?.rating ?? 0)
  const [body, setBody] = useState(ownReview?.body ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!isValidRating(rating)) {
      setError('Pick a rating from 1 to 5.')
      return
    }
    if (!isValidReviewBody(body)) {
      setError(`Review can't be longer than ${MAX_REVIEW_BODY_LENGTH} characters.`)
      return
    }

    startTransition(async () => {
      try {
        await submitReviewAction(truckId, slug, rating, body || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteReviewAction(truckId, slug)
        setRating(0)
        setBody('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 max-w-md">
      <h3 className="font-medium">{ownReview ? 'Edit your review' : 'Write a review'}</h3>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            aria-pressed={rating === value}
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
            className={rating >= value ? 'text-yellow-500' : 'text-gray-300'}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_REVIEW_BODY_LENGTH}
        placeholder="Optional — tell others what you thought"
        className="mt-2 w-full rounded border p-2 text-sm"
        rows={3}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {ownReview ? 'Update review' : 'Submit review'}
        </button>
        {ownReview && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  )
}

function HideReviewButton({ reviewId, slug }: { reviewId: string; slug: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await setReviewVisibilityAction(reviewId, slug, false)
        })
      }
      className="mt-1 text-xs text-red-600 disabled:opacity-50"
    >
      Hide (admin)
    </button>
  )
}
