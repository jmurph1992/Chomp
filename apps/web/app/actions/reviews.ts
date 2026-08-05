'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit, reviewLimiter } from '@/lib/rate-limit'
import { deleteReview, upsertReview } from '@/lib/reviews'

export async function submitReviewAction(
  truckId: string,
  slug: string,
  rating: number,
  body: string | null,
): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in to write a review')
  await checkRateLimit(reviewLimiter, user.id)

  await upsertReview({ truckId, userId: user.id, rating, body })
  revalidatePath(`/trucks/${slug}`)
}

export async function deleteReviewAction(truckId: string, slug: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in to manage your review')

  await deleteReview(truckId, user.id)
  revalidatePath(`/trucks/${slug}`)
}
