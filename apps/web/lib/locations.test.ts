import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateMany = vi.fn()
const executeRaw = vi.fn()
const txFindFirst = vi.fn()
const findFirst = vi.fn()
const dbUpdateMany = vi.fn()
const inngestSend = vi.fn()
const tx = { truckLocation: { updateMany, findFirst: txFindFirst }, $executeRaw: executeRaw }
const transaction = vi.fn((callback: (txArg: typeof tx) => unknown) => callback(tx))

vi.mock('@chomp/db', () => ({
  db: {
    $transaction: transaction,
    truckLocation: { findFirst, updateMany: dbUpdateMany },
  },
}))

vi.mock('@/inngest/client', () => ({ inngest: { send: inngestSend } }))

const { postLocation, getCurrentLocation, extendLocation } = await import('./locations')

const oneHourFromNow = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()

describe('postLocation', () => {
  beforeEach(() => {
    updateMany.mockReset()
    executeRaw.mockReset()
    txFindFirst.mockReset()
    transaction.mockClear()
    inngestSend.mockReset()
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
    txFindFirst.mockResolvedValue(null)
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

  it('fires app/truck.activated when no active location existed before this post', async () => {
    txFindFirst.mockResolvedValue(null) // no active location found inside the transaction
    updateMany.mockResolvedValue({ count: 0 })
    executeRaw.mockResolvedValue(undefined)

    await postLocation('t1', { lat: 30.27, lng: -97.74, address: null, expiresAt: oneHourFromNow() })

    expect(inngestSend).toHaveBeenCalledWith({ name: 'app/truck.activated', data: { truckId: 't1' } })
  })

  it('does not fire app/truck.activated when the truck was already active', async () => {
    txFindFirst.mockResolvedValue({ id: 'existing-location' })
    updateMany.mockResolvedValue({ count: 1 })
    executeRaw.mockResolvedValue(undefined)

    await postLocation('t1', { lat: 30.27, lng: -97.74, address: null, expiresAt: oneHourFromNow() })

    expect(inngestSend).not.toHaveBeenCalled()
  })

  it('checks for an active location using the same freshness rule as extendLocation, inside the transaction', async () => {
    txFindFirst.mockResolvedValue(null)
    updateMany.mockResolvedValue({ count: 0 })
    executeRaw.mockResolvedValue(undefined)

    await postLocation('t1', { lat: 30.27, lng: -97.74, address: null, expiresAt: oneHourFromNow() })

    expect(txFindFirst).toHaveBeenCalledWith({
      where: {
        truckId: 't1',
        isCurrent: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
      select: { id: true },
    })
    // Must run against the transaction client, not the top-level db client,
    // so it can't race the write it's gating.
    expect(findFirst).not.toHaveBeenCalled()
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
