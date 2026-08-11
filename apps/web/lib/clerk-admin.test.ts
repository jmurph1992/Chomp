import { describe, it, expect, vi, beforeEach } from 'vitest'

const banUser = vi.fn()
const unbanUser = vi.fn()
const deleteUser = vi.fn()
const clerkClient = vi.fn(async () => ({ users: { banUser, unbanUser, deleteUser } }))

// The one file allowed to mock @clerk/nextjs/server directly — this module
// is itself the abstraction boundary every other file goes through instead.
vi.mock('@clerk/nextjs/server', () => ({ clerkClient }))

const { banClerkUser, unbanClerkUser, deleteClerkUser } = await import('./clerk-admin')

describe('clerk-admin', () => {
  beforeEach(() => {
    banUser.mockReset()
    unbanUser.mockReset()
    deleteUser.mockReset()
  })

  it('banClerkUser calls users.banUser with the given clerk id', async () => {
    await banClerkUser('clerk_1')
    expect(banUser).toHaveBeenCalledWith('clerk_1')
  })

  it('unbanClerkUser calls users.unbanUser with the given clerk id', async () => {
    await unbanClerkUser('clerk_1')
    expect(unbanUser).toHaveBeenCalledWith('clerk_1')
  })

  it('deleteClerkUser calls users.deleteUser with the given clerk id', async () => {
    await deleteClerkUser('clerk_1')
    expect(deleteUser).toHaveBeenCalledWith('clerk_1')
  })
})
