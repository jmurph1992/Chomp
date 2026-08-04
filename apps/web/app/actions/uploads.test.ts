import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUser = vi.fn()
const createUploadSlot = vi.fn()
const ingestUploadedImage = vi.fn()
const checkRateLimit = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit, uploadSlotLimiter: {} }))
vi.mock('@/lib/storage', () => ({ createUploadSlot, ingestUploadedImage }))

const { requestUploadSlotAction, finalizeUploadAction } = await import('./uploads')

beforeEach(() => {
  getCurrentUser.mockReset()
  createUploadSlot.mockReset()
  ingestUploadedImage.mockReset()
  checkRateLimit.mockReset().mockResolvedValue(undefined)
})

describe('requestUploadSlotAction', () => {
  it('rejects when signed out, without requesting a slot — prevents anonymous abuse of a billed resource', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(requestUploadSlotAction('image/jpeg')).rejects.toThrow('Sign in required')
    expect(createUploadSlot).not.toHaveBeenCalled()
  })

  it('rejects when the caller has hit the upload-slot rate limit, without requesting a slot', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    checkRateLimit.mockRejectedValue(new Error("You're doing that too often — try again in a bit."))

    await expect(requestUploadSlotAction('image/jpeg')).rejects.toThrow('too often')
    expect(createUploadSlot).not.toHaveBeenCalled()
  })

  it('requests a slot for a signed-in caller', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    createUploadSlot.mockResolvedValue({ url: 'https://r2', fields: {}, key: 'uploads/x' })

    const result = await requestUploadSlotAction('image/jpeg')

    expect(checkRateLimit).toHaveBeenCalledWith(expect.anything(), 'u1')
    expect(createUploadSlot).toHaveBeenCalledWith('image/jpeg')
    expect(result.key).toBe('uploads/x')
  })
})

describe('finalizeUploadAction', () => {
  it('rejects when signed out, without ingesting', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(finalizeUploadAction('uploads/x')).rejects.toThrow('Sign in required')
    expect(ingestUploadedImage).not.toHaveBeenCalled()
  })

  it('ingests for a signed-in caller', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    ingestUploadedImage.mockResolvedValue({ url: 'https://imagedelivery.net/h/i/public', imageId: 'i' })

    const result = await finalizeUploadAction('uploads/x')

    expect(ingestUploadedImage).toHaveBeenCalledWith('uploads/x')
    expect(result.imageId).toBe('i')
  })
})
