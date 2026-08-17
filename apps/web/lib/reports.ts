import { db } from '@chomp/db'
import type { ContentReportInput, ContentReportReasonValue, ContentReportView } from '@chomp/types'
import { setReviewPhotoVisibility } from './review-photos'
import { setReviewVisibility } from './reviews'

const VALID_REASONS: ContentReportReasonValue[] = ['spam', 'inappropriate', 'harassment', 'other']

function validateReportInput(input: ContentReportInput): void {
  if (!VALID_REASONS.includes(input.reason)) throw new Error('Invalid report reason')
}

/**
 * Reports someone else's review. Rejects reporting your own (a real
 * server-side check, not just a UI-hidden button) and a repeat report from
 * the same user on the same review — one report per (review, reporter),
 * checked with a findFirst rather than a DB unique constraint (see
 * schema.prisma's ContentReport doc comment for why).
 */
export async function reportReview(
  reviewId: string,
  reporterUserId: string,
  input: ContentReportInput,
): Promise<void> {
  validateReportInput(input)

  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { userId: true, isVisible: true },
  })
  if (!review || !review.isVisible) throw new Error('Review not found')
  if (review.userId === reporterUserId) throw new Error("You can't report your own review")

  const existing = await db.contentReport.findFirst({ where: { reviewId, reporterUserId } })
  if (existing) throw new Error("You've already reported this review")

  await db.contentReport.create({
    data: { reviewId, reporterUserId, reason: input.reason, note: input.note },
  })
}

/** Same shape as reportReview, for a review's attached photo. */
export async function reportReviewPhoto(
  photoId: string,
  reporterUserId: string,
  input: ContentReportInput,
): Promise<void> {
  validateReportInput(input)

  const photo = await db.reviewPhoto.findUnique({
    where: { id: photoId },
    select: { userId: true, isVisible: true },
  })
  if (!photo || !photo.isVisible) throw new Error('Photo not found')
  if (photo.userId === reporterUserId) throw new Error("You can't report your own photo")

  const existing = await db.contentReport.findFirst({ where: { reviewPhotoId: photoId, reporterUserId } })
  if (existing) throw new Error("You've already reported this photo")

  await db.contentReport.create({
    data: { reviewPhotoId: photoId, reporterUserId, reason: input.reason, note: input.note },
  })
}

/**
 * Every report across all trucks, for the admin queue — same "getAll +
 * client-side filter" shape as getAllReviewsForAdmin, not just open ones,
 * so admins can review report history. Excludes reports on orphaned
 * (truck-deleted) reviews/photos, same reasoning getAllReviewsForAdmin
 * already applies — no truck left to moderate against.
 */
export async function getAllContentReports(): Promise<ContentReportView[]> {
  const rows = await db.contentReport.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      review: { select: { id: true, body: true, rating: true, truck: { select: { slug: true, name: true } } } },
      reviewPhoto: {
        select: { id: true, url: true, caption: true, truck: { select: { slug: true, name: true } } },
      },
      reporter: { select: { email: true } },
      resolvedByUser: { select: { email: true } },
    },
  })

  return rows.flatMap((row) => {
    const truck = row.review?.truck ?? row.reviewPhoto?.truck
    if (!truck) return [] // orphaned target (truck deleted) — nothing left to moderate against

    return [
      {
        id: row.id,
        reason: row.reason,
        note: row.note,
        status: row.status,
        reporterEmail: row.reporter?.email ?? null,
        truckSlug: truck.slug,
        truckName: truck.name,
        review: row.review ? { id: row.review.id, body: row.review.body, rating: row.review.rating } : null,
        reviewPhoto: row.reviewPhoto
          ? { id: row.reviewPhoto.id, url: row.reviewPhoto.url, caption: row.reviewPhoto.caption }
          : null,
        createdAt: row.createdAt.toISOString(),
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
        resolvedByEmail: row.resolvedByUser?.email ?? null,
        resolutionNote: row.resolutionNote,
      },
    ]
  })
}

/**
 * Hides the reported content via the same setReviewVisibility/
 * setReviewPhotoVisibility primitive the existing per-item admin hide
 * button uses. Derives which content to hide from the report row itself,
 * never from client input — an admin's request can only ever hide the
 * content this specific report actually names.
 *
 * Deliberately doesn't separately mark `report` resolved after hiding:
 * setReviewVisibility/setReviewPhotoVisibility already close out every open
 * ContentReport on that item (this one included, since it's open when this
 * runs) as part of hiding it — see those functions' own comments. One
 * primitive, no duplicate update.
 */
export async function resolveContentReport(
  reportId: string,
  adminUserId: string,
  resolutionNote: string,
): Promise<void> {
  if (!resolutionNote.trim()) throw new Error('A resolution reason is required')

  const report = await db.contentReport.findUnique({ where: { id: reportId } })
  if (!report || report.status !== 'open') throw new Error('Report not found or already resolved')

  if (report.reviewId) {
    await setReviewVisibility(report.reviewId, false, resolutionNote, adminUserId)
  } else if (report.reviewPhotoId) {
    await setReviewPhotoVisibility(report.reviewPhotoId, false, resolutionNote, adminUserId)
  }
}

/**
 * The opposite of resolveContentReport — this specific report wasn't
 * actionable. Touches only this report, never the underlying content, and
 * never cascades to other open reports on the same item (a dismissal is a
 * judgment on this one report, not proof the content itself is fine).
 */
export async function dismissContentReport(
  reportId: string,
  adminUserId: string,
  resolutionNote: string,
): Promise<void> {
  if (!resolutionNote.trim()) throw new Error('A resolution reason is required')

  const result = await db.contentReport.updateMany({
    where: { id: reportId, status: 'open' },
    data: { status: 'dismissed', resolvedByUserId: adminUserId, resolvedAt: new Date(), resolutionNote },
  })
  if (result.count === 0) throw new Error('Report not found or already resolved')
}
