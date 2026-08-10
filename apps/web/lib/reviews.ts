import { db } from '@chomp/db'
import { isValidRating } from '@chomp/utils'
import type { AdminReviewView, MyReviewView, ReviewSummary, ReviewView } from '@chomp/types'
import { deleteReviewPhoto } from './review-photos'
import { isValidReviewBody } from './review-validation'

export { MAX_REVIEW_BODY_LENGTH, isValidReviewBody } from './review-validation'

type ReviewRow = {
  id: string
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

// truckId is passed in separately, not read off the row — both call sites
// below already know it (it's their own query's filter), and Review.truckId
// is nullable at the DB level now (orphaned once a truck is deleted), which
// these truck-scoped views never surface.
function toReviewView(row: ReviewRow, truckId: string): ReviewView {
  const photo = row.photos[0]
  return {
    id: row.id,
    truckId,
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
  return rows.map((row) => toReviewView(row, truckId))
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
  return row ? toReviewView(row, truckId) : null
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

/**
 * The moderation primitive. A reason is always required, in either direction —
 * it's stored as the review's moderation note along with who made the change
 * and when, overwriting whatever the previous moderation action left behind.
 * No permission check inside it; the caller (the server action) is
 * responsible for calling `requireAdmin()` first.
 */
export async function setReviewVisibility(
  reviewId: string,
  isVisible: boolean,
  reason: string,
  moderatorUserId: string,
): Promise<void> {
  if (!reason.trim()) throw new Error('A moderation reason is required')

  await db.review.update({
    where: { id: reviewId },
    data: {
      isVisible,
      moderationNote: reason,
      moderatedByUserId: moderatorUserId,
      moderatedAt: new Date(),
    },
  })
}

/**
 * Every review across all trucks, for the admin moderation queue. Excludes
 * orphaned reviews (truckId: null, from a deleted truck) — there's no truck
 * left to moderate against, so they're not a workaround, they're correctly
 * out of scope for this queue.
 */
export async function getAllReviewsForAdmin(): Promise<AdminReviewView[]> {
  const rows = await db.review.findMany({
    where: { truckId: { not: null } },
    orderBy: { createdAt: 'desc' },
    include: {
      truck: { select: { slug: true, name: true } },
      user: { select: { displayName: true, email: true } },
      moderator: { select: { email: true } },
    },
  })

  // The where clause above already excludes orphaned rows, but Prisma's
  // generated type can't reflect that — this guard both narrows the type
  // and defends against the filter ever being loosened by mistake.
  return rows.flatMap((row) => {
    if (!row.truck || row.truckId === null) return []
    return [{
      id: row.id,
      truckId: row.truckId,
      truckSlug: row.truck.slug,
      truckName: row.truck.name,
      userDisplayName: row.user.displayName,
      userEmail: row.user.email,
      rating: row.rating,
      body: row.body,
      isVisible: row.isVisible,
      moderationNote: row.moderationNote,
      moderatedByEmail: row.moderator?.email ?? null,
      moderatedAt: row.moderatedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }]
  })
}

/**
 * Every review written by a user, across all trucks, for their own account
 * page — the one place an orphaned (truck-deleted) review is ever shown to
 * anyone. No isVisible filter, same reasoning as getOwnReview: a user must
 * always see their own review even if a moderator hid it; isVisible is
 * still included on the returned view so the UI can show a "hidden" note
 * rather than silently omitting it.
 */
export async function getReviewsForUser(userId: string): Promise<MyReviewView[]> {
  const rows = await db.review.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      truck: { select: { slug: true, name: true } },
      photos: { take: 1, select: { id: true, url: true, caption: true } },
    },
  })

  return rows.map((row) => {
    const photo = row.photos[0]
    return {
      id: row.id,
      truckId: row.truckId,
      truckSlug: row.truck?.slug ?? null,
      truckName: row.truck?.name ?? null,
      rating: row.rating,
      body: row.body,
      isVisible: row.isVisible,
      createdAt: row.createdAt.toISOString(),
      photo: photo ? { id: photo.id, url: photo.url, caption: photo.caption } : null,
    }
  })
}
