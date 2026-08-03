import { randomUUID } from 'node:crypto'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { UploadSlot } from '@chomp/types'

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024 // 8MB
export const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export function isValidImageContentType(contentType: string): boolean {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)
}

function r2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

function bucket(): string {
  return process.env.CLOUDFLARE_R2_BUCKET_NAME ?? ''
}

/**
 * Presigned POST for a direct browser-to-R2 upload. Unlike a presigned PUT,
 * the POST policy can declaratively enforce content-type and a size range —
 * R2 itself rejects an upload outside these bounds, this isn't just a
 * client-side check. R2 is a transient intake buffer only; the object is
 * deleted once ingestUploadedImage() hands it off to Cloudflare Images (see
 * that function, and the R2 lifecycle-rule note in .env.example for uploads
 * that are never finalized at all).
 */
export async function createUploadSlot(contentType: string): Promise<UploadSlot> {
  if (!isValidImageContentType(contentType)) {
    throw new Error(`Unsupported content type: ${contentType}`)
  }

  const key = `uploads/${randomUUID()}`
  const { url, fields } = await createPresignedPost(r2Client(), {
    Bucket: bucket(),
    Key: key,
    Conditions: [
      ['content-length-range', 1, MAX_UPLOAD_BYTES],
      ['eq', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: 300, // 5 minutes to complete the upload
  })

  return { url, fields, key }
}

/** Re-verifies the actual uploaded object server-side — never trust the POST policy alone. */
async function verifyUploadedObject(key: string): Promise<void> {
  const result = await r2Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }))
  const size = result.ContentLength ?? 0
  const contentType = result.ContentType ?? ''

  if (size <= 0 || size > MAX_UPLOAD_BYTES) throw new Error('Uploaded file size is invalid')
  if (!isValidImageContentType(contentType)) throw new Error('Uploaded file type is invalid')
}

async function getPresignedGetUrl(key: string): Promise<string> {
  return getSignedUrl(r2Client(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: 300,
  })
}

async function deleteFromR2(key: string): Promise<void> {
  await r2Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
}

/** Recovers the Cloudflare Images id from one of our own delivery URLs, for cleanup calls. */
export function extractCloudflareImageId(url: string): string | null {
  const match = url.match(/^https:\/\/imagedelivery\.net\/[^/]+\/([^/]+)\/[^/]+$/)
  return match ? (match[1] ?? null) : null
}

type CloudflareImageResult = { id: string; variants: string[] }

async function cloudflareImagesRequest(path: string, init: RequestInit): Promise<unknown> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${apiToken}` },
  })
  const data = await response.json()
  if (!response.ok || (data as { success?: boolean }).success === false) {
    throw new Error(`Cloudflare Images request failed: ${JSON.stringify(data)}`)
  }
  return data
}

async function createCloudflareImage(sourceUrl: string): Promise<CloudflareImageResult> {
  const form = new FormData()
  form.append('url', sourceUrl)
  const data = (await cloudflareImagesRequest('/images/v1', {
    method: 'POST',
    body: form,
  })) as { result: CloudflareImageResult }
  return data.result
}

/** Best-effort cleanup — a failure here shouldn't block the caller's own operation. */
export async function deleteCloudflareImage(imageId: string): Promise<void> {
  try {
    await cloudflareImagesRequest(`/images/v1/${imageId}`, { method: 'DELETE' })
  } catch (err) {
    console.error(`Failed to delete Cloudflare Image ${imageId}:`, err)
  }
}

/**
 * The core upload primitive: verifies the R2 object, hands it to Cloudflare
 * Images via a short-lived presigned GET (R2 stays fully private — no public
 * bucket needed), and deletes the R2 copy either way. Doesn't know about
 * reviews/menus/trucks — callers (server actions) are responsible for their
 * own authorization before calling this, since this alone only proves "a
 * signed-in-enough caller uploaded *an* image," not that they're allowed to
 * attach it to any particular truck/review.
 */
export async function ingestUploadedImage(key: string): Promise<{ url: string; imageId: string }> {
  await verifyUploadedObject(key)
  const sourceUrl = await getPresignedGetUrl(key)

  let result: CloudflareImageResult
  try {
    result = await createCloudflareImage(sourceUrl)
  } finally {
    await deleteFromR2(key)
  }

  const url =
    result.variants[0] ??
    `https://imagedelivery.net/${process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH}/${result.id}/public`
  return { url, imageId: result.id }
}
