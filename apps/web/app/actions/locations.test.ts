import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireOperator = vi.fn()
const postLocation = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/operators', () => ({ requireOperator }))
vi.mock('@/lib/locations', () => ({ postLocation }))
vi.mock('next/cache', () => ({ revalidatePath }))

const { postLocationAction } = await import('./locations')

beforeEach(() => {
  requireOperator.mockReset()
  postLocation.mockReset()
})

describe('postLocationAction', () => {
  const input = { lat: 30.27, lng: -97.74, address: '123 Main St' }

  it('rejects an unauthorized caller before writing', async () => {
    requireOperator.mockRejectedValue(new Error('Not authorized to manage this truck'))
    await expect(postLocationAction('t1', 'slug', input)).rejects.toThrow('Not authorized')
    expect(postLocation).not.toHaveBeenCalled()
  })

  it('posts the location for an authorized operator', async () => {
    requireOperator.mockResolvedValue({ role: 'owner' })
    postLocation.mockResolvedValue(undefined)

    await postLocationAction('t1', 'slug', input)

    expect(postLocation).toHaveBeenCalledWith('t1', input)
  })
})
