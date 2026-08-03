'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { attachReviewPhoto, deleteReviewPhoto, likePhoto, unlikePhoto } from '@/lib/review-photos'

function revalidateTruck(slug: string) {
  revalidatePath(`/trucks/${slug}`)
  revalidatePath('/feed')
}

export async function attachReviewPhotoAction(
  truckId: string,
  slug: string,
  uploadKey: string,
  caption: string | null,
): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')

  await attachReviewPhoto(truckId, user.id, uploadKey, caption)
  revalidateTruck(slug)
}

export async function deleteReviewPhotoAction(truckId: string, slug: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')

  await deleteReviewPhoto(truckId, user.id)
  revalidateTruck(slug)
}

export async function likePhotoAction(truckId: string, slug: string, photoId: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')

  await likePhoto(truckId, photoId, user.id)
  revalidateTruck(slug)
}

export async function unlikePhotoAction(
  truckId: string,
  slug: string,
  photoId: string,
): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')

  await unlikePhoto(truckId, photoId, user.id)
  revalidateTruck(slug)
}
