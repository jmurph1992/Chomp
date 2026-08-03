'use client'

import { useState } from 'react'
import { finalizeUploadAction, requestUploadSlotAction } from '@/app/actions/uploads'

/**
 * Requests a presigned slot and uploads the file directly to R2, returning
 * the R2 key. Deliberately doesn't finalize — some callers (menu/profile
 * images) want a ready-to-store URL via finalizeUploadAction, others (review
 * photos) hand the raw key to a domain-specific action that does the
 * Cloudflare Images ingest itself as part of attaching to a review.
 */
export async function uploadToR2(file: File): Promise<string> {
  const slot = await requestUploadSlotAction(file.type)

  const formData = new FormData()
  for (const [key, value] of Object.entries(slot.fields)) formData.append(key, value)
  formData.append('file', file)

  const response = await fetch(slot.url, { method: 'POST', body: formData })
  if (!response.ok) throw new Error('Upload to storage failed')

  return slot.key
}

type UploadState = 'idle' | 'uploading' | 'error'

/** For fields that just need a ready-to-store URL (menu item photo, truck logo/cover). */
export function useImageUpload() {
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File): Promise<string | null> {
    setState('uploading')
    setError(null)
    try {
      const key = await uploadToR2(file)
      const { url } = await finalizeUploadAction(key)
      setState('idle')
      return url
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Upload failed')
      return null
    }
  }

  return { upload, isUploading: state === 'uploading', error }
}
