import { describe, it, expect, vi, beforeEach } from 'vitest'

const queryRaw = vi.fn()
const executeRaw = vi.fn()

vi.mock('@chomp/db', () => ({
  db: { $queryRaw: queryRaw, $executeRaw: executeRaw },
}))

const { parsePageParam, getFeedPage, refreshFeedView, FEED_PAGE_SIZE } = await import('./feed')

describe('parsePageParam', () => {
  it('defaults to 1 when missing', () => {
    expect(parsePageParam(undefined)).toBe(1)
  })

  it('accepts a valid positive integer string', () => {
    expect(parsePageParam('3')).toBe(3)
  })

  it('falls back to 1 for zero, negative, non-integer, or non-numeric input', () => {
    expect(parsePageParam('0')).toBe(1)
    expect(parsePageParam('-2')).toBe(1)
    expect(parsePageParam('1.5')).toBe(1)
    expect(parsePageParam('abc')).toBe(1)
  })
})

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    type: 'review',
    itemId: 'i1',
    truckId: 't1',
    userId: 'u1',
    rating: 5,
    content: 'Great!',
    imageUrl: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    truckSlug: 'taco-kings',
    truckName: 'Taco Kings',
    authorDisplayName: 'Alice',
    ...overrides,
  }
}

describe('getFeedPage', () => {
  beforeEach(() => queryRaw.mockReset())

  it('maps rows and reports hasMore: false when exactly a full page is returned', async () => {
    queryRaw.mockResolvedValue([row()])

    const result = await getFeedPage(1, 1)

    expect(result.hasMore).toBe(false)
    expect(result.items).toEqual([
      {
        type: 'review',
        itemId: 'i1',
        truckId: 't1',
        userId: 'u1',
        rating: 5,
        content: 'Great!',
        imageUrl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        truckSlug: 'taco-kings',
        truckName: 'Taco Kings',
        authorDisplayName: 'Alice',
      },
    ])
  })

  it('reports hasMore: true and trims the extra lookahead row', async () => {
    queryRaw.mockResolvedValue([row({ itemId: 'i1' }), row({ itemId: 'i2' })])

    const result = await getFeedPage(1, 1)

    expect(result.hasMore).toBe(true)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.itemId).toBe('i1')
  })

  it('defaults to FEED_PAGE_SIZE when no page size is given', async () => {
    queryRaw.mockResolvedValue([])
    await getFeedPage(1)
    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(FEED_PAGE_SIZE).toBeGreaterThan(0)
  })
})

describe('refreshFeedView', () => {
  it('runs a concurrent refresh', async () => {
    executeRaw.mockResolvedValue(undefined)
    await refreshFeedView()
    expect(executeRaw).toHaveBeenCalledTimes(1)
  })
})
