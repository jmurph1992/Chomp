import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUser = vi.fn()

vi.mock('./auth', () => ({ getCurrentUser }))

const { requireAdmin } = await import('./admin')

describe('requireAdmin', () => {
  beforeEach(() => getCurrentUser.mockReset())

  it('rejects when signed out', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(requireAdmin()).rejects.toThrow('Not authorized')
  })

  it('rejects a signed-in non-admin', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', role: 'customer' })
    await expect(requireAdmin()).rejects.toThrow('Not authorized')
  })

  it('resolves with the user for an admin', async () => {
    const admin = { id: 'admin1', role: 'admin' }
    getCurrentUser.mockResolvedValue(admin)
    await expect(requireAdmin()).resolves.toEqual(admin)
  })
})
