import { db } from '@chomp/db'
import { isValidRating } from '@chomp/utils'
import type { ReviewSummary, ReviewView } from '@chomp/types'

export const MAX_REVIEW_BODY_LENGTH = 2000

export function isValidReviewBody(body: string | null | undefined): boolean {
  if (body === null || body === undefined || body === '') return true
  return typeof body === 'string' && body.length <= MAX_REVIEW_BODY_LENGTH
}

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
}

function toReviewView(row: ReviewRow): ReviewView {
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
  }
}

/** Public review list for a truck. Hidden reviews never appear here. */
export async function getVisibleReviewsForTruck(truckId: string): Promise<ReviewView[]> {
  const rows = await db.review.findMany({
    where: { truckId, isVisible: true },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { displayName: true, avatarUrl: true } } },
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
 * able to see/edit/delete their own review even if a moderator hid it. Never
 * use this for anything other than the acting user's own review.
 */
export async function getOwnReview(truckId: string, userId: string): Promise<ReviewView | null> {
  const row = await db.review.findUnique({
    where: { truckId_userId: { truckId, userId } },
    include: { user: { select: { displayName: true, avatarUrl: true } } },
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

export async function deleteReview(truckId: string, userId: string): Promise<void> {
  await db.review.deleteMany({ where: { truckId, userId } })
}

export async function setReviewVisibility(reviewId: string, isVisible: boolean): Promise<void> {
  await db.review.update({ where: { id: reviewId }, data: { isVisible } })
}
