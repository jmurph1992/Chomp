import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireAdmin = vi.fn()
const getUserById = vi.fn()
const findSoleOwnedTrucks = vi.fn()
const deactivateTrucks = vi.fn()
const banClerkUser = vi.fn()
const deleteClerkUser = vi.fn()
const openErasureBlockedEntry = vi.fn()
const resolveModerationEntry = vi.fn()
const dismissModerationEntry = vi.fn()
const deleteTruck = vi.fn()
const adminReassignTruckOwner = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/admin', () => ({ requireAdmin }))
vi.mock('@/lib/users', () => ({ getUserById }))
vi.mock('@/lib/user-erasure', () => ({ findSoleOwnedTrucks, deactivateTrucks }))
vi.mock('@/lib/clerk-admin', () => ({ banClerkUser, deleteClerkUser }))
vi.mock('@/lib/moderation-queue', () => ({ openErasureBlockedEntry, resolveModerationEntry, dismissModerationEntry }))
vi.mock('@/lib/trucks', () => ({ deleteTruck }))
vi.mock('@/lib/invites', () => ({ adminReassignTruckOwner }))
vi.mock('next/cache', () => ({ revalidatePath }))

const {
  deleteUserAction,
  resolveModerationEntryAction,
  dismissModerationEntryAction,
  adminDeleteTruckAction,
  adminReassignTruckOwnerAction,
} = await import('./admin-users')

describe('deleteUserAction', () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    getUserById.mockReset()
    findSoleOwnedTrucks.mockReset()
    deactivateTrucks.mockReset()
    banClerkUser.mockReset()
    deleteClerkUser.mockReset()
    openErasureBlockedEntry.mockReset()
    revalidatePath.mockReset()
  })

  it('rejects a non-admin, without touching anything', async () => {
    requireAdmin.mockRejectedValue(new Error('Not authorized'))
    await expect(deleteUserAction('u1', 'ada@example.com')).rejects.toThrow('Not authorized')
    expect(getUserById).not.toHaveBeenCalled()
  })

  it('rejects an unknown user', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', email: 'admin@example.com' })
    getUserById.mockResolvedValue(null)
    await expect(deleteUserAction('u1', 'ada@example.com')).rejects.toThrow('User not found')
  })

  it('refuses to target an admin account', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', email: 'admin@example.com' })
    getUserById.mockResolvedValue({ id: 'u1', email: 'other-admin@example.com', role: 'admin', clerkId: 'clerk_1' })
    await expect(deleteUserAction('u1', 'other-admin@example.com')).rejects.toThrow('Admin accounts')
    expect(findSoleOwnedTrucks).not.toHaveBeenCalled()
  })

  it('rejects a mismatched confirmation email, without deleting', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', email: 'admin@example.com' })
    getUserById.mockResolvedValue({ id: 'u1', email: 'ada@example.com', role: 'customer', clerkId: 'clerk_1' })
    await expect(deleteUserAction('u1', 'wrong@example.com')).rejects.toThrow('Email does not match')
    expect(deleteClerkUser).not.toHaveBeenCalled()
  })

  it('blocks, deactivates trucks, bans, and opens a moderation entry when the target is a sole owner', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', email: 'admin@example.com' })
    const target = { id: 'u1', email: 'ada@example.com', role: 'customer', clerkId: 'clerk_1' }
    getUserById.mockResolvedValue(target)
    findSoleOwnedTrucks.mockResolvedValue([{ id: 't1', name: 'Taco Kings', slug: 'taco-kings' }])

    const result = await deleteUserAction('u1', 'ada@example.com')

    expect(result).toEqual({ blocked: true })
    expect(deactivateTrucks).toHaveBeenCalledWith(['t1'])
    expect(banClerkUser).toHaveBeenCalledWith('clerk_1')
    expect(openErasureBlockedEntry).toHaveBeenCalledWith(
      target,
      [{ id: 't1', name: 'Taco Kings', slug: 'taco-kings' }],
      expect.stringContaining('admin@example.com'),
    )
    expect(deleteClerkUser).not.toHaveBeenCalled()
  })

  it('deletes in Clerk (not blocked) when the target owns nothing', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', email: 'admin@example.com' })
    getUserById.mockResolvedValue({ id: 'u1', email: 'ada@example.com', role: 'customer', clerkId: 'clerk_1' })
    findSoleOwnedTrucks.mockResolvedValue([])

    const result = await deleteUserAction('u1', 'ada@example.com')

    expect(result).toEqual({ blocked: false })
    expect(deleteClerkUser).toHaveBeenCalledWith('clerk_1')
    expect(banClerkUser).not.toHaveBeenCalled()
    expect(openErasureBlockedEntry).not.toHaveBeenCalled()
  })
})

describe('resolveModerationEntryAction / dismissModerationEntryAction', () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    resolveModerationEntry.mockReset()
    dismissModerationEntry.mockReset()
    revalidatePath.mockReset()
  })

  it('resolveModerationEntryAction rejects a non-admin without delegating', async () => {
    requireAdmin.mockRejectedValue(new Error('Not authorized'))
    await expect(resolveModerationEntryAction('entry1', 'note')).rejects.toThrow('Not authorized')
    expect(resolveModerationEntry).not.toHaveBeenCalled()
  })

  it('resolveModerationEntryAction delegates with the admin id', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', email: 'admin@example.com' })
    await resolveModerationEntryAction('entry1', 'Cleared')
    expect(resolveModerationEntry).toHaveBeenCalledWith('entry1', 'admin1', 'Cleared')
  })

  it('dismissModerationEntryAction rejects a non-admin without delegating', async () => {
    requireAdmin.mockRejectedValue(new Error('Not authorized'))
    await expect(dismissModerationEntryAction('entry1', 'note')).rejects.toThrow('Not authorized')
    expect(dismissModerationEntry).not.toHaveBeenCalled()
  })

  it('dismissModerationEntryAction delegates with the admin id', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', email: 'admin@example.com' })
    await dismissModerationEntryAction('entry1', 'False positive')
    expect(dismissModerationEntry).toHaveBeenCalledWith('entry1', 'admin1', 'False positive')
  })
})

describe('adminDeleteTruckAction / adminReassignTruckOwnerAction', () => {
  beforeEach(() => {
    requireAdmin.mockReset()
    deleteTruck.mockReset()
    adminReassignTruckOwner.mockReset()
    revalidatePath.mockReset()
  })

  it('adminDeleteTruckAction rejects a non-admin, without deleting', async () => {
    requireAdmin.mockRejectedValue(new Error('Not authorized'))
    await expect(adminDeleteTruckAction('t1', 'Taco Kings')).rejects.toThrow('Not authorized')
    expect(deleteTruck).not.toHaveBeenCalled()
  })

  it('adminDeleteTruckAction delegates to the unchanged deleteTruck', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1' })
    await adminDeleteTruckAction('t1', 'Taco Kings')
    expect(deleteTruck).toHaveBeenCalledWith('t1', 'Taco Kings')
  })

  it('adminReassignTruckOwnerAction rejects a non-admin, without reassigning', async () => {
    requireAdmin.mockRejectedValue(new Error('Not authorized'))
    await expect(adminReassignTruckOwnerAction('t1', 'u2')).rejects.toThrow('Not authorized')
    expect(adminReassignTruckOwner).not.toHaveBeenCalled()
  })

  it('adminReassignTruckOwnerAction delegates to lib/invites', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1' })
    await adminReassignTruckOwnerAction('t1', 'u2')
    expect(adminReassignTruckOwner).toHaveBeenCalledWith('t1', 'u2')
  })
})
