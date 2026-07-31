import { describe, it, expect } from 'vitest'
import { getTodaysScheduleEntries } from './schedule'
import type { TruckScheduleEntry } from '@chomp/types'

function entry(overrides: Partial<TruckScheduleEntry>): TruckScheduleEntry {
  return {
    id: 'sched_1',
    dayOfWeek: null,
    specificDate: null,
    startTime: null,
    endTime: null,
    locationNote: null,
    address: null,
    isCancelled: false,
    ...overrides,
  }
}

describe('getTodaysScheduleEntries', () => {
  // Wednesday, 2026-07-29
  const wednesday = new Date('2026-07-29T12:00:00Z')

  it('includes a recurring entry matching today\'s day of week', () => {
    const result = getTodaysScheduleEntries([entry({ dayOfWeek: 3 })], wednesday)
    expect(result).toHaveLength(1)
  })

  it('excludes recurring entries for other days', () => {
    const result = getTodaysScheduleEntries([entry({ dayOfWeek: 4 })], wednesday)
    expect(result).toHaveLength(0)
  })

  it('includes a one-off entry matching the specific date, ignoring dayOfWeek', () => {
    const result = getTodaysScheduleEntries(
      [entry({ dayOfWeek: 1, specificDate: '2026-07-29T00:00:00.000Z' })],
      wednesday,
    )
    expect(result).toHaveLength(1)
  })

  it('excludes a one-off entry for a different date', () => {
    const result = getTodaysScheduleEntries(
      [entry({ specificDate: '2026-07-30T00:00:00.000Z' })],
      wednesday,
    )
    expect(result).toHaveLength(0)
  })

  it('excludes cancelled entries even if the date/day matches', () => {
    const result = getTodaysScheduleEntries([entry({ dayOfWeek: 3, isCancelled: true })], wednesday)
    expect(result).toHaveLength(0)
  })
})
