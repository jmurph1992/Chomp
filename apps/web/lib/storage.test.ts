import { describe, it, expect, vi, beforeEach } from 'vitest'

const s3Send = vi.fn()
const createPresignedPost = vi.fn()
const getSignedUrl = vi.fn()

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: s3Send })),
  HeadObjectCommand: vi.fn().mockImplementation((input) => ({ type: 'Head', input })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ type: 'Delete', input })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ type: 'Get', input })),
}))
vi.mock('@aws-sdk/s3-presigned-post', () => ({ createPresignedPost }))
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl }))

const {
  MAX_UPLOAD_BYTES,
  isValidImageContentType,
  createUploadSlot,
  ingestUploadedImage,
  deleteCloudflareImage,
  extractCloudflareImageId,
} = await import('./storage')

beforeEach(() => {
  s3Send.mockReset()
  createPresignedPost.mockReset()
  getSignedUrl.mockReset()
  process.env.CLOUDFLARE_ACCOUNT_ID = 'account123'
  process.env.CLOUDFLARE_API_TOKEN = 'token123'
  process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH = 'hash123'
  vi.stubGlobal('fetch', vi.fn())
})

describe('isValidImageContentType', () => {
  it('accepts jpeg/png/webp', () => {
    expect(isValidImageContentType('image/jpeg')).toBe(true)
    expect(isValidImageContentType('image/png')).toBe(true)
    expect(isValidImageContentType('image/webp')).toBe(true)
  })

  it('rejects everything else, including svg (can carry scripts)', () => {
    expect(isValidImageContentType('image/svg+xml')).toBe(false)
    expect(isValidImageContentType('text/html')).toBe(false)
    expect(isValidImageContentType('application/octet-stream')).toBe(false)
  })
})

describe('extractCloudflareImageId', () => {
  it('parses the image id out of a delivery URL', () => {
    expect(extractCloudflareImageId('https://imagedelivery.net/hash123/img-abc/public')).toBe(
      'img-abc',
    )
  })

  it('returns null for a URL that does not match the pattern', () => {
    expect(extractCloudflareImageId('https://example.com/foo.jpg')).toBeNull()
  })
})

describe('createUploadSlot', () => {
  it('rejects an unsupported content type without calling R2', async () => {
    await expect(createUploadSlot('text/html')).rejects.toThrow('Unsupported content type')
    expect(createPresignedPost).not.toHaveBeenCalled()
  })

  it('constrains the presigned POST policy by content-type and size range', async () => {
    createPresignedPost.mockResolvedValue({ url: 'https://r2.example/bucket', fields: { key: 'x' } })

    const slot = await createUploadSlot('image/jpeg')

    expect(slot.key).toMatch(/^uploads\//)
    const call = createPresignedPost.mock.calls.at(0)?.at(1)
    expect(call.Conditions).toContainEqual(['content-length-range', 1, MAX_UPLOAD_BYTES])
    expect(call.Conditions).toContainEqual(['eq', '$Content-Type', 'image/jpeg'])
  })
})

describe('ingestUploadedImage', () => {
  function mockFetchOk(result: unknown) {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result }),
    })
  }

  it('rejects when the actual uploaded object is oversized, without calling Cloudflare', async () => {
    s3Send.mockResolvedValue({ ContentLength: MAX_UPLOAD_BYTES + 1, ContentType: 'image/jpeg' })

    await expect(ingestUploadedImage('uploads/abc')).rejects.toThrow('size is invalid')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects when the actual uploaded object has a disallowed content type', async () => {
    s3Send.mockResolvedValue({ ContentLength: 1000, ContentType: 'text/html' })

    await expect(ingestUploadedImage('uploads/abc')).rejects.toThrow('type is invalid')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('ingests via a presigned GET and deletes the R2 object on success', async () => {
    s3Send.mockResolvedValueOnce({ ContentLength: 1000, ContentType: 'image/jpeg' }) // HEAD
    getSignedUrl.mockResolvedValue('https://r2.example/presigned-get')
    mockFetchOk({ id: 'img-1', variants: ['https://imagedelivery.net/hash123/img-1/public'] })
    s3Send.mockResolvedValueOnce(undefined) // DELETE

    const result = await ingestUploadedImage('uploads/abc')

    expect(result).toEqual({ url: 'https://imagedelivery.net/hash123/img-1/public', imageId: 'img-1' })
    // Second S3 call is the delete.
    expect(s3Send).toHaveBeenCalledTimes(2)
    expect(s3Send.mock.calls[1]![0].type).toBe('Delete')
  })

  it('still deletes the R2 object when Cloudflare Images ingest fails', async () => {
    s3Send.mockResolvedValueOnce({ ContentLength: 1000, ContentType: 'image/jpeg' }) // HEAD
    getSignedUrl.mockResolvedValue('https://r2.example/presigned-get')
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false, errors: ['boom'] }),
    })
    s3Send.mockResolvedValueOnce(undefined) // DELETE

    await expect(ingestUploadedImage('uploads/abc')).rejects.toThrow('Cloudflare Images request failed')
    expect(s3Send).toHaveBeenCalledTimes(2)
    expect(s3Send.mock.calls[1]![0].type).toBe('Delete')
  })
})

describe('deleteCloudflareImage', () => {
  it('does not throw when the delete request fails — best-effort cleanup', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ success: false }),
    })

    await expect(deleteCloudflareImage('img-1')).resolves.toBeUndefined()
  })
})
