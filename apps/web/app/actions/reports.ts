'use server'

import type { ContentReportInput } from '@chomp/types'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit, reportLimiter } from '@/lib/rate-limit'
import { reportReview, reportReviewPhoto } from '@/lib/reports'

// No revalidatePath — a report has no visible effect on the reporter's own
// page (reports are admin-only, see lib/reports.ts); the UI shows a local
// "Reported" confirmation instead of refetching anything.

export async function reportReviewAction(reviewId: string, input: ContentReportInput): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')
  await checkRateLimit(reportLimiter, user.id)

  await reportReview(reviewId, user.id, input)
}

export async function reportReviewPhotoAction(photoId: string, input: ContentReportInput): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')
  await checkRateLimit(reportLimiter, user.id)

  await reportReviewPhoto(photoId, user.id, input)
}
