import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateMany = vi.fn()
const executeRaw = vi.fn()
const findFirst = vi.fn()
const tx = { truckLocation: { updateMany }, $executeRaw: executeRaw }
const transaction = vi.fn((callback: (txArg: typeof tx) => unknown) => callback(tx))

vi.mock('@chomp/db', () => ({
  db: {
    $transaction: transaction,
    truckLocation: { findFirst },
  },
}))

const { postLocation, getCurrentLocation } = await import('./locations')

describe('postLocation', () => {
  beforeEach(() => {
    updateMany.mockReset()
    executeRaw.mockReset()
    transaction.mockClear()
  })

  it('rejects invalid coordinates without starting a transaction', async () => {
    await expect(postLocation('t1', { lat: 999, lng: 0, address: null })).rejects.toThrow(
      'Invalid coordinates',
    )
    expect(transaction).not.toHaveBeenCalled()
  })

  it('retires the previous current location before inserting the new one', async () => {
    updateMany.mockResolvedValue({ count: 1 })
    executeRaw.mockResolvedValue(undefined)

    await postLocation('t1', { lat: 30.27, lng: -97.74, address: '123 Main St' })

    expect(updateMany).toHaveBeenCalledWith({
      where: { truckId: 't1', isCurrent: true },
      data: { isCurrent: false },
    })
    expect(executeRaw).toHaveBeenCalledTimes(1)
  })
})

describe('getCurrentLocation', () => {
  beforeEach(() => findFirst.mockReset())

  it('returns null when the truck has no current location', async () => {
    findFirst.mockResolvedValue(null)
    expect(await getCurrentLocation('t1')).toBeNull()
  })

  it('maps the current location row', async () => {
    findFirst.mockResolvedValue({ address: '123 Main St', reportedAt: new Date('2026-01-01T00:00:00Z') })

    const result = await getCurrentLocation('t1')

    expect(result).toEqual({ address: '123 Main St', reportedAt: '2026-01-01T00:00:00.000Z' })
  })
})
