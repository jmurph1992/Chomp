'use server'

import type { UploadSlot } from '@chomp/types'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit, uploadSlotLimiter } from '@/lib/rate-limit'
import { createUploadSlot, ingestUploadedImage } from '@/lib/storage'

/**
 * Generic upload primitives — don't know about reviews/menus/trucks, so they
 * can't enforce truck-level authorization (that happens where the resulting
 * URL actually gets persisted: updateMenuItemAction, attachReviewPhotoAction,
 * etc.). They still require *some* signed-in caller, though — without that,
 * anyone could mint successful Cloudflare Images ingests (a billed resource)
 * with zero authorization check anywhere in the flow.
 */
export async function requestUploadSlotAction(contentType: string): Promise<UploadSlot> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')
  await checkRateLimit(uploadSlotLimiter, user.id)

  return createUploadSlot(contentType)
}

export async function finalizeUploadAction(key: string): Promise<{ url: string; imageId: string }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in required')

  return ingestUploadedImage(key)
}
