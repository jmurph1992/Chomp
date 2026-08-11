import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUser = vi.fn()
const deleteClerkUser = vi.fn()
const findSoleOwnedTrucks = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser }))
vi.mock('@/lib/clerk-admin', () => ({ deleteClerkUser }))
vi.mock('@/lib/user-erasure', () => ({ findSoleOwnedTrucks }))

const { deleteOwnAccountAction } = await import('./account')

describe('deleteOwnAccountAction', () => {
  beforeEach(() => {
    getCurrentUser.mockReset()
    deleteClerkUser.mockReset()
    findSoleOwnedTrucks.mockReset()
  })

  it('rejects when signed out, without touching anything', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(deleteOwnAccountAction('ada@example.com')).rejects.toThrow('Sign in required')
    expect(findSoleOwnedTrucks).not.toHaveBeenCalled()
  })

  it('rejects a mismatched confirmation email, without deleting', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', email: 'ada@example.com', clerkId: 'clerk_1' })
    await expect(deleteOwnAccountAction('wrong@example.com')).rejects.toThrow('Email does not match')
    expect(deleteClerkUser).not.toHaveBeenCalled()
  })

  it('matches the confirmation email case-insensitively, trimmed', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', email: 'ada@example.com', clerkId: 'clerk_1' })
    findSoleOwnedTrucks.mockResolvedValue([])

    await deleteOwnAccountAction('  Ada@Example.com  ')

    expect(deleteClerkUser).toHaveBeenCalledWith('clerk_1')
  })

  it('blocks with the blocking truck names, without calling Clerk, when the caller is a sole owner', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', email: 'ada@example.com', clerkId: 'clerk_1' })
    findSoleOwnedTrucks.mockResolvedValue([{ id: 't1', name: 'Taco Kings', slug: 'taco-kings' }])

    await expect(deleteOwnAccountAction('ada@example.com')).rejects.toThrow('Taco Kings')
    expect(deleteClerkUser).not.toHaveBeenCalled()
  })

  it('resolves the blocking-ownership check and the Clerk deletion off the caller\'s own session, never a passed-in id', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', email: 'ada@example.com', clerkId: 'clerk_1' })
    findSoleOwnedTrucks.mockResolvedValue([])

    await deleteOwnAccountAction('ada@example.com')

    expect(findSoleOwnedTrucks).toHaveBeenCalledWith('u1')
    expect(deleteClerkUser).toHaveBeenCalledWith('clerk_1')
    expect(deleteClerkUser).toHaveBeenCalledTimes(1)
  })
})
