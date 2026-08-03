import { db } from '@chomp/db'
import { isValidRating } from '@chomp/utils'
import type { ReviewSummary, ReviewView } from '@chomp/types'
import { deleteReviewPhoto } from './review-photos'
import { isValidReviewBody } from './review-validation'

export { MAX_REVIEW_BODY_LENGTH, isValidReviewBody } from './review-validation'

/** Only an admin may hide/unhide another user's review. */
export function canModerateReviews(role: string | null | undefined): boolean {
  return role === 'admin'
}

type ReviewRow = {
  id: string
  truckId: string
  userId: string
  rating: number
  body: string | null
  isVisible: boolean
  createdAt: Date
  user: { displayName: string | null; avatarUrl: string | null }
  photos: {
    id: string
    url: string
    caption: string | null
    likesCount: number
    likes: { userId: string }[]
  }[]
}

function toReviewView(row: ReviewRow): ReviewView {
  const photo = row.photos[0]
  return {
    id: row.id,
    truckId: row.truckId,
    userId: row.userId,
    userDisplayName: row.user.displayName,
    userAvatarUrl: row.user.avatarUrl,
    rating: row.rating,
    body: row.body,
    isVisible: row.isVisible,
    createdAt: row.createdAt.toISOString(),
    photo: photo
      ? {
          id: photo.id,
          url: photo.url,
          caption: photo.caption,
          likesCount: photo.likesCount,
          isLikedByViewer: photo.likes.length > 0,
        }
      : null,
  }
}

/**
 * Public review list for a truck. Hidden reviews never appear here, and each
 * review's photo (if any) is separately filtered to isVisible: true — a
 * hidden photo shouldn't leak here even if its review is visible. `viewerId`
 * is optional (anonymous visitors get isLikedByViewer: false for everything);
 * passing '' rather than making the `likes` include conditional keeps the
 * Prisma include shape consistent regardless of sign-in state.
 */
export async function getVisibleReviewsForTruck(
  truckId: string,
  viewerId?: string | null,
): Promise<ReviewView[]> {
  const rows = await db.review.findMany({
    where: { truckId, isVisible: true },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { displayName: true, avatarUrl: true } },
      photos: {
        where: { isVisible: true },
        take: 1,
        include: { likes: { where: { userId: viewerId ?? '' } } },
      },
    },
  })
  return rows.map(toReviewView)
}

export async function getReviewSummary(truckId: string): Promise<ReviewSummary> {
  const result = await db.review.aggregate({
    where: { truckId, isVisible: true },
    _avg: { rating: true },
    _count: { _all: true },
  })
  return { averageRating: result._avg.rating, reviewCount: result._count._all }
}

/**
 * The viewer's own review, regardless of isVisible — a user must always be
 * able to see/edit/delete their own review (and its photo) even if a
 * moderator hid it. Never use this for anything other than the acting user's
 * own review.
 */
export async function getOwnReview(truckId: string, userId: string): Promise<ReviewView | null> {
  const row = await db.review.findUnique({
    where: { truckId_userId: { truckId, userId } },
    include: {
      user: { select: { displayName: true, avatarUrl: true } },
      photos: { take: 1, include: { likes: { where: { userId } } } },
    },
  })
  return row ? toReviewView(row) : null
}

/** Creates or updates the caller's review for this truck (one review per user per truck). */
export async function upsertReview(params: {
  truckId: string
  userId: string
  rating: number
  body: string | null
}): Promise<void> {
  const { truckId, userId, rating, body } = params
  if (!isValidRating(rating)) throw new Error(`Invalid rating: ${rating}`)
  if (!isValidReviewBody(body)) throw new Error('Review body too long')

  await db.review.upsert({
    where: { truckId_userId: { truckId, userId } },
    create: { truckId, userId, rating, body },
    update: { rating, body },
  })
}

/**
 * Deletes the caller's review. review_photos.review_id is ON DELETE RESTRICT
 * (no cascade), so any attached photo (and its likes) must be cleaned up
 * first or this would fail on the FK constraint.
 */
export async function deleteReview(truckId: string, userId: string): Promise<void> {
  await deleteReviewPhoto(truckId, userId)
  await db.review.deleteMany({ where: { truckId, userId } })
}

export async function setReviewVisibility(reviewId: string, isVisible: boolean): Promise<void> {
  await db.review.update({ where: { id: reviewId }, data: { isVisible } })
}
