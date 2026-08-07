import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUser = vi.fn()
const requireOperator = vi.fn()
const createInvite = vi.fn()
const cancelInvite = vi.fn()
const claimInvite = vi.fn()
const removeManager = vi.fn()
const checkRateLimit = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser }))
vi.mock('@/lib/operators', () => ({ requireOperator }))
vi.mock('@/lib/invites', () => ({ createInvite, cancelInvite, claimInvite, removeManager }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit, inviteLimiter: {} }))
vi.mock('next/cache', () => ({ revalidatePath }))

const { createInviteAction, cancelInviteAction, removeManagerAction, claimInviteAction } =
  await import('./invites')

beforeEach(() => {
  getCurrentUser.mockReset()
  requireOperator.mockReset()
  createInvite.mockReset()
  cancelInvite.mockReset()
  claimInvite.mockReset()
  removeManager.mockReset()
  checkRateLimit.mockReset().mockResolvedValue(undefined)
  revalidatePath.mockReset()
})

const owner = { user: { id: 'owner1' }, role: 'owner' as const }
const manager = { user: { id: 'mgr1' }, role: 'manager' as const }

describe('createInviteAction', () => {
  it('rejects a non-operator, without writing', async () => {
    requireOperator.mockRejectedValue(new Error('Not authorized to manage this truck'))
    await expect(createInviteAction('t1', 'a@b.com')).rejects.toThrow('Not authorized')
    expect(createInvite).not.toHaveBeenCalled()
  })

  it('rejects a manager (owner-only action), without writing', async () => {
    requireOperator.mockResolvedValue(manager)
    await expect(createInviteAction('t1', 'a@b.com')).rejects.toThrow('Only the truck owner')
    expect(createInvite).not.toHaveBeenCalled()
  })

  it('rejects when rate-limited, before creating the invite', async () => {
    requireOperator.mockResolvedValue(owner)
    checkRateLimit.mockRejectedValue(new Error("You're doing that too often — try again in a bit."))
    await expect(createInviteAction('t1', 'a@b.com')).rejects.toThrow('too often')
    expect(createInvite).not.toHaveBeenCalled()
  })

  it('creates the invite for an owner and returns a shareable URL', async () => {
    requireOperator.mockResolvedValue(owner)
    createInvite.mockResolvedValue({
      id: 'inv1',
      invitedEmail: 'a@b.com',
      token: 'tok-1',
      status: 'pending',
      createdAt: '2026-08-07T00:00:00.000Z',
      expiresAt: '2026-08-14T00:00:00.000Z',
    })

    const result = await createInviteAction('t1', 'a@b.com')

    expect(createInvite).toHaveBeenCalledWith('t1', 'owner1', 'a@b.com')
    expect(result.url).toContain('/invite/tok-1')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/t1/team')
  })
})

describe('cancelInviteAction', () => {
  it('rejects a manager, without writing', async () => {
    requireOperator.mockResolvedValue(manager)
    await expect(cancelInviteAction('t1', 'inv1')).rejects.toThrow('Only the truck owner')
    expect(cancelInvite).not.toHaveBeenCalled()
  })

  it('cancels for an owner and revalidates', async () => {
    requireOperator.mockResolvedValue(owner)
    await cancelInviteAction('t1', 'inv1')
    expect(cancelInvite).toHaveBeenCalledWith('t1', 'inv1')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/t1/team')
  })
})

describe('removeManagerAction', () => {
  it('rejects a manager, without writing', async () => {
    requireOperator.mockResolvedValue(manager)
    await expect(removeManagerAction('t1', 'u2')).rejects.toThrow('Only the truck owner')
    expect(removeManager).not.toHaveBeenCalled()
  })

  it('removes for an owner and revalidates', async () => {
    requireOperator.mockResolvedValue(owner)
    await removeManagerAction('t1', 'u2')
    expect(removeManager).toHaveBeenCalledWith('t1', 'u2', 'owner1')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/t1/team')
  })
})

describe('claimInviteAction', () => {
  it('rejects when signed out, without calling claimInvite', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(claimInviteAction('tok-1')).rejects.toThrow('Sign in required')
    expect(claimInvite).not.toHaveBeenCalled()
  })

  it('delegates to claimInvite for a signed-in user and revalidates the dashboard', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u2', email: 'friend@example.com' })
    claimInvite.mockResolvedValue({ truckId: 't1' })

    const result = await claimInviteAction('tok-1')

    expect(claimInvite).toHaveBeenCalledWith('tok-1', { id: 'u2', email: 'friend@example.com' })
    expect(result).toEqual({ truckId: 't1' })
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it('propagates errors from claimInvite unchanged', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u2', email: 'friend@example.com' })
    claimInvite.mockRejectedValue(new Error('This invite has expired'))

    await expect(claimInviteAction('tok-1')).rejects.toThrow('This invite has expired')
  })
})
