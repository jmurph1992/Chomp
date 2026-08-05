import { describe, it, expect, vi, beforeEach } from 'vitest'

const refreshFeedView = vi.fn()
const createFunction = vi.fn((config, handler) => ({ config, handler }))

vi.mock('@/lib/feed', () => ({ refreshFeedView }))
vi.mock('./client', () => ({ inngest: { createFunction } }))

const { refreshFeedHandler, refreshFeedFunction } = await import('./functions')

describe('refreshFeedHandler', () => {
  beforeEach(() => refreshFeedView.mockReset())

  it('runs refreshFeedView inside a named step', async () => {
    refreshFeedView.mockResolvedValue(undefined)
    let stepId: string | null = null
    async function run<T>(id: string, fn: () => Promise<T>): Promise<T> {
      stepId = id
      return fn()
    }

    await refreshFeedHandler({ step: { run } })

    expect(stepId).toBe('refresh-feed-view')
    expect(refreshFeedView).toHaveBeenCalledTimes(1)
  })
})

describe('refreshFeedFunction', () => {
  it('registers with the expected id and a daily cron trigger', () => {
    expect(createFunction).toHaveBeenCalledWith(
      {
        id: 'refresh-feed',
        name: 'Refresh feed materialized view',
        triggers: [{ cron: '0 0 * * *' }],
      },
      refreshFeedHandler,
    )
  })

  it('is the value returned by inngest.createFunction', () => {
    expect(refreshFeedFunction).toEqual({
      config: {
        id: 'refresh-feed',
        name: 'Refresh feed materialized view',
        triggers: [{ cron: '0 0 * * *' }],
      },
      handler: refreshFeedHandler,
    })
  })
})
