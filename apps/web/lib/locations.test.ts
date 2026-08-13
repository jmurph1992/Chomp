import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateMany = vi.fn()
const executeRaw = vi.fn()
const findFirst = vi.fn()
const dbUpdateMany = vi.fn()
const tx = { truckLocation: { updateMany }, $executeRaw: executeRaw }
const transaction = vi.fn((callback: (txArg: typeof tx) => unknown) => callback(tx))

vi.mock('@chomp/db', () => ({
  db: {
    $transaction: transaction,
    truckLocation: { findFirst, updateMany: dbUpdateMany },
  },
}))

const { postLocation, getCurrentLocation, extendLocation } = await import('./locations')

const oneHourFromNow = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()

describe('postLocation', () => {
  beforeEach(() => {
    updateMany.mockReset()
    executeRaw.mockReset()
    transaction.mockClear()
  })

  it('rejects invalid coordinates without starting a transaction', async () => {
    await expect(
      postLocation('t1', { lat: 999, lng: 0, address: null, expiresAt: oneHourFromNow() }),
    ).rejects.toThrow('Invalid coordinates')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects an invalid expiresAt without starting a transaction', async () => {
    await expect(
      postLocation('t1', { lat: 30.27, lng: -97.74, address: null, expiresAt: 'not-a-date' }),
    ).rejects.toThrow('Invalid expiresAt')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('retires the previous current location before inserting the new one', async () => {
    updateMany.mockResolvedValue({ count: 1 })
    executeRaw.mockResolvedValue(undefined)

    await postLocation('t1', {
      lat: 30.27,
      lng: -97.74,
      address: '123 Main St',
      expiresAt: oneHourFromNow(),
    })

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

  it('maps the current location row, including a real expiresAt', async () => {
    findFirst.mockResolvedValue({
      address: '123 Main St',
      reportedAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: new Date('2026-01-01T06:00:00Z'),
    })

    const result = await getCurrentLocation('t1')

    expect(result).toEqual({
      address: '123 Main St',
      reportedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T06:00:00.000Z',
    })
  })

  it('maps a null expiresAt (legacy pre-feature row)', async () => {
    findFirst.mockResolvedValue({
      address: '123 Main St',
      reportedAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: null,
    })

    const result = await getCurrentLocation('t1')

    expect(result?.expiresAt).toBeNull()
  })
})

describe('extendLocation', () => {
  beforeEach(() => dbUpdateMany.mockReset())

  it('rejects an invalid expiresAt without updating', async () => {
    await expect(extendLocation('t1', 'not-a-date')).rejects.toThrow('Invalid expiresAt')
    expect(dbUpdateMany).not.toHaveBeenCalled()
  })

  it('throws when no active location matched (already expired or none exists)', async () => {
    dbUpdateMany.mockResolvedValue({ count: 0 })

    await expect(extendLocation('t1', oneHourFromNow())).rejects.toThrow(
      'No active location to extend — post a fresh location instead',
    )
  })

  it('updates the current location expiresAt when one is active', async () => {
    dbUpdateMany.mockResolvedValue({ count: 1 })
    const expiresAt = oneHourFromNow()

    await extendLocation('t1', expiresAt)

    expect(dbUpdateMany).toHaveBeenCalledWith({
      where: {
        truckId: 't1',
        isCurrent: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
      data: { expiresAt: new Date(expiresAt) },
    })
  })
})
