import { db } from '@chomp/db'
import { deleteCloudflareImage, extractCloudflareImageId, ingestUploadedImage } from './storage'

export const MAX_CAPTION_LENGTH = 300

export function isValidCaption(caption: string | null): boolean {
  if (caption === null) return true
  return caption.length <= MAX_CAPTION_LENGTH
}

function isUniqueConstraintViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002'
}

/**
 * Deletes an existing ReviewPhoto (and its likes — review_photos/photo_likes
 * FKs are ON DELETE RESTRICT, no cascade, so likes must go first) and
 * best-effort cleans up its Cloudflare Images asset. No-op if there isn't one.
 */
async function removeExistingPhoto(reviewId: string): Promise<void> {
  const existing = await db.reviewPhoto.findFirst({ where: { reviewId } })
  if (!existing) return

  await db.photoLike.deleteMany({ where: { photoId: existing.id } })
  await db.reviewPhoto.delete({ where: { id: existing.id } })

  const imageId = extractCloudflareImageId(existing.url)
  if (imageId) await deleteCloudflareImage(imageId)
}

/**
 * Attaches (or replaces) the caller's own review's photo. Derives the review
 * from (truckId, userId) — never accepts a client-supplied reviewId, so a
 * caller can only ever attach a photo to their own review.
 */
export async function attachReviewPhoto(
  truckId: string,
  userId: string,
  uploadKey: string,
  caption: string | null,
): Promise<void> {
  if (!isValidCaption(caption)) throw new Error('Caption too long')

  const review = await db.review.findUnique({ where: { truckId_userId: { truckId, userId } } })
  if (!review) throw new Error('Write a review before attaching a photo')

  const { url } = await ingestUploadedImage(uploadKey)

  await removeExistingPhoto(review.id)
  await db.reviewPhoto.create({
    data: { reviewId: review.id, userId, truckId, url, caption, isVisible: true, likesCount: 0 },
  })
}

/**
 * Removes the caller's own review's photo, if any. Used both as a standalone
 * "remove my photo" action and as cleanup before deleting the review itself
 * (review_photos.review_id is ON DELETE RESTRICT — deleting a Review with an
 * attached photo would otherwise fail on the FK constraint).
 */
export async function deleteReviewPhoto(truckId: string, userId: string): Promise<void> {
  const review = await db.review.findUnique({ where: { truckId_userId: { truckId, userId } } })
  if (!review) return
  await removeExistingPhoto(review.id)
}

/**
 * Only visible photos can be liked — a hidden photo shouldn't accumulate more
 * likes. Scoped by truckId too, not just photoId, for the same reason every
 * other mutation in this codebase scopes by truckId (see lib/menu.ts) — it's
 * not strictly a privilege boundary here (liking isn't truck-specific), but
 * it catches a mismatched truckId/photoId pair as "not found" instead of
 * silently operating on the wrong truck's data.
 */
export async function likePhoto(truckId: string, photoId: string, userId: string): Promise<void> {
  const photo = await db.reviewPhoto.findUnique({ where: { id: photoId } })
  if (!photo || !photo.isVisible || photo.truckId !== truckId) throw new Error('Photo not found')

  try {
    await db.$transaction(async (tx) => {
      await tx.photoLike.create({ data: { photoId, userId } })
      await tx.reviewPhoto.update({
        where: { id: photoId },
        data: { likesCount: { increment: 1 } },
      })
    })
  } catch (err) {
    if (isUniqueConstraintViolation(err)) return // already liked — idempotent no-op
    throw err
  }
}

export async function unlikePhoto(truckId: string, photoId: string, userId: string): Promise<void> {
  const result = await db.photoLike.deleteMany({ where: { photoId, userId, photo: { truckId } } })
  if (result.count === 0) return // wasn't liked (or wrong truck) — idempotent no-op

  await db.reviewPhoto.update({ where: { id: photoId }, data: { likesCount: { decrement: 1 } } })
}

/**
 * Removes every like a user has left, decrementing each photo's likesCount
 * exactly once per removed like. Used by the account-erasure job before
 * db.user.delete() — PhotoLike.userId has onDelete: Cascade for the ordinary
 * case, but a raw DB cascade would remove the rows without ever touching the
 * denormalized counter, silently desyncing it. Same per-row idempotent shape
 * as unlikePhoto, batched: naturally safe to retry, since a re-run only finds
 * whatever likes are still left.
 */
export async function removeAllPhotoLikesForUser(userId: string): Promise<void> {
  const likes = await db.photoLike.findMany({ where: { userId }, select: { photoId: true } })

  for (const { photoId } of likes) {
    const result = await db.photoLike.deleteMany({ where: { photoId, userId } })
    if (result.count === 0) continue // already removed by a concurrent/retried call
    await db.reviewPhoto.update({ where: { id: photoId }, data: { likesCount: { decrement: 1 } } })
  }
}
