'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs'
import type { ReviewPhotoView, ReviewSummary, ReviewView } from '@chomp/types'
import { isValidRating } from '@chomp/utils'
import { deleteReviewAction, submitReviewAction } from '@/app/actions/reviews'
import {
  attachReviewPhotoAction,
  deleteReviewPhotoAction,
  likePhotoAction,
  unlikePhotoAction,
} from '@/app/actions/review-photos'
import { MAX_REVIEW_BODY_LENGTH, isValidReviewBody } from '@/lib/review-validation'
import { uploadToR2 } from './use-image-upload'

type Props = {
  truckId: string
  slug: string
  reviews: ReviewView[]
  summary: ReviewSummary
  ownReview: ReviewView | null
}

export function TruckReviews({ truckId, slug, reviews, summary, ownReview }: Props) {
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
            {review.photo && (
              <div className="mt-2">
                <Image
                  src={review.photo.url}
                  alt={review.photo.caption ?? ''}
                  width={200}
                  height={200}
                  unoptimized
                  className="h-40 w-40 rounded object-cover"
                />
                {review.photo.caption && <p className="mt-1 text-xs text-gray-500">{review.photo.caption}</p>}
                <PhotoLikeButton truckId={truckId} slug={slug} photo={review.photo} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function PhotoLikeButton({
  truckId,
  slug,
  photo,
}: {
  truckId: string
  slug: string
  photo: ReviewPhotoView
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <SignedIn>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              if (photo.isLikedByViewer) {
                await unlikePhotoAction(truckId, slug, photo.id)
              } else {
                await likePhotoAction(truckId, slug, photo.id)
              }
            })
          }
          className="mt-1 text-sm disabled:opacity-50"
        >
          {photo.isLikedByViewer ? '♥' : '♡'} {photo.likesCount}
        </button>
      </SignedIn>
      <SignedOut>
        <span className="mt-1 block text-sm text-gray-500">
          ♡ {photo.likesCount}
        </span>
      </SignedOut>
    </>
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
    <div className="mt-4 max-w-md">
      <form onSubmit={handleSubmit}>
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

      {/* Attaching a photo requires the review to already exist — the flow is
          submit the review, then attach a photo to it. */}
      {ownReview && (
        <ReviewPhotoSection truckId={truckId} slug={slug} photo={ownReview.photo} />
      )}
    </div>
  )
}

function ReviewPhotoSection({
  truckId,
  slug,
  photo,
}: {
  truckId: string
  slug: string
  photo: ReviewPhotoView | null
}) {
  const [caption, setCaption] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    setIsUploading(true)
    try {
      const key = await uploadToR2(file)
      startTransition(() => {
        attachReviewPhotoAction(truckId, slug, key, caption.trim() || null).catch((err) => {
          setError(err instanceof Error ? err.message : 'Something went wrong.')
        })
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  function handleRemove() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteReviewPhotoAction(truckId, slug)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  const busy = isUploading || isPending

  return (
    <div className="mt-3 border-t pt-3">
      {photo ? (
        <div>
          <Image
            src={photo.url}
            alt={photo.caption ?? ''}
            width={120}
            height={120}
            unoptimized
            className="h-24 w-24 rounded object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="mt-1 block text-xs text-red-600 disabled:opacity-50"
          >
            Remove photo
          </button>
        </div>
      ) : (
        <>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="w-full rounded border p-1 text-sm"
          />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={handleFileChange}
            className="mt-1 text-sm"
          />
        </>
      )}
      {busy && <p className="text-sm text-gray-500">Saving photo…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
