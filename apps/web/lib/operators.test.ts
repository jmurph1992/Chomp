import { describe, it, expect, vi, beforeEach } from 'vitest'

const findMany = vi.fn()
const findUnique = vi.fn()
const getCurrentUser = vi.fn()

vi.mock('@chomp/db', () => ({
  db: { truckOperator: { findMany, findUnique } },
}))
vi.mock('./auth', () => ({ getCurrentUser }))

const { getOperatedTrucks, getTruckOperatorRole, requireOperator } = await import('./operators')

describe('getOperatedTrucks', () => {
  beforeEach(() => findMany.mockReset())

  it('maps TruckOperator rows to OperatedTruck summaries', async () => {
    findMany.mockResolvedValue([
      { role: 'owner', truck: { id: 't1', slug: 'taco-kings', name: 'Taco Kings' } },
      { role: 'manager', truck: { id: 't2', slug: 'pho-real', name: 'Pho Real' } },
    ])

    const result = await getOperatedTrucks('u1')

    expect(result).toEqual([
      { id: 't1', slug: 'taco-kings', name: 'Taco Kings', role: 'owner' },
      { id: 't2', slug: 'pho-real', name: 'Pho Real', role: 'manager' },
    ])
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1' } }))
  })
})

describe('getTruckOperatorRole', () => {
  beforeEach(() => findUnique.mockReset())

  it('looks up by the compound truckId_userId key', async () => {
    findUnique.mockResolvedValue({ role: 'owner' })
    const role = await getTruckOperatorRole('t1', 'u1')

    expect(role).toBe('owner')
    expect(findUnique).toHaveBeenCalledWith({
      where: { truckId_userId: { truckId: 't1', userId: 'u1' } },
    })
  })

  it('returns null when no membership row exists', async () => {
    findUnique.mockResolvedValue(null)
    expect(await getTruckOperatorRole('t1', 'u1')).toBeNull()
  })
})

describe('requireOperator', () => {
  beforeEach(() => {
    findUnique.mockReset()
    getCurrentUser.mockReset()
  })

  it('rejects when signed out', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(requireOperator('t1')).rejects.toThrow('Sign in required')
  })

  it('rejects a signed-in user who is not an operator of this truck at all', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', role: 'customer' })
    findUnique.mockResolvedValue(null)

    await expect(requireOperator('t1')).rejects.toThrow('Not authorized')
  })

  it('rejects an operator of a DIFFERENT truck — the core IDOR case', async () => {
    // u1 operates t2, not t1. Confirms the check is scoped to the exact
    // truckId requested, not "is this user an operator of anything."
    getCurrentUser.mockResolvedValue({ id: 'u1', role: 'operator' })
    findUnique.mockImplementation(({ where }) =>
      where.truckId_userId.truckId === 't2' ? Promise.resolve({ role: 'owner' }) : Promise.resolve(null),
    )

    await expect(requireOperator('t1')).rejects.toThrow('Not authorized')
  })

  it('succeeds for the owner of this truck', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', role: 'operator' })
    findUnique.mockResolvedValue({ role: 'owner' })

    const result = await requireOperator('t1')
    expect(result.role).toBe('owner')
  })

  it('succeeds for a manager of this truck (full parity with owner)', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u2', role: 'operator' })
    findUnique.mockResolvedValue({ role: 'manager' })

    const result = await requireOperator('t1')
    expect(result.role).toBe('manager')
  })
})
