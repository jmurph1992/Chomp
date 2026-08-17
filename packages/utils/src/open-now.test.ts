import { describe, it, expect } from 'vitest'
import { getOpenNowStatus, type OpenNowScheduleEntry } from './open-now'

function entry(overrides: Partial<OpenNowScheduleEntry>): OpenNowScheduleEntry {
  return {
    dayOfWeek: null,
    specificDate: null,
    startTime: null,
    endTime: null,
    isCancelled: false,
    ...overrides,
  }
}

// 2026-01-06T02:00:00Z is Monday 20:00 in America/Chicago (CST, UTC-6) and
// Tuesday 11:00 in Asia/Tokyo (UTC+9) — same instant, different local day
// AND different local hour, so tests against both prove real Intl-based
// timezone conversion, not a UTC pass-through in disguise.
const NOW = new Date('2026-01-06T02:00:00.000Z')

describe('getOpenNowStatus', () => {
  it('returns unknown when no timezone is set, without inspecting the schedule', () => {
    expect(getOpenNowStatus([entry({ dayOfWeek: 1 })], null, NOW)).toEqual({ status: 'unknown' })
  })

  it('returns closed when there are no entries for today', () => {
    // Chicago-local "today" at NOW is Monday — a Tuesday-only entry never matches.
    const schedule = [
      entry({ dayOfWeek: 2, startTime: '1970-01-01T00:00:00.000Z', endTime: '1970-01-01T23:00:00.000Z' }),
    ]
    expect(getOpenNowStatus(schedule, 'America/Chicago', NOW)).toEqual({ status: 'closed' })
  })

  it('returns open when the local time falls within a matching entry, with closesAt', () => {
    // Chicago-local time at NOW is Monday 20:00 — inside a Monday 19:00-21:00 window.
    const schedule = [
      entry({ dayOfWeek: 1, startTime: '1970-01-01T19:00:00.000Z', endTime: '1970-01-01T21:00:00.000Z' }),
    ]
    expect(getOpenNowStatus(schedule, 'America/Chicago', NOW)).toEqual({
      status: 'open',
      closesAt: '1970-01-01T21:00:00.000Z',
    })
  })

  it('the boundary is [start, end) — exactly at endTime is closed, exactly at startTime is open', () => {
    const openAtStart = [
      entry({ dayOfWeek: 1, startTime: '1970-01-01T20:00:00.000Z', endTime: '1970-01-01T21:00:00.000Z' }),
    ]
    expect(getOpenNowStatus(openAtStart, 'America/Chicago', NOW).status).toBe('open')

    const closedAtEnd = [
      entry({ dayOfWeek: 1, startTime: '1970-01-01T19:00:00.000Z', endTime: '1970-01-01T20:00:00.000Z' }),
    ]
    expect(getOpenNowStatus(closedAtEnd, 'America/Chicago', NOW).status).toBe('closed')
  })

  it('excludes cancelled entries even when the time window matches', () => {
    const schedule = [
      entry({
        dayOfWeek: 1,
        startTime: '1970-01-01T19:00:00.000Z',
        endTime: '1970-01-01T21:00:00.000Z',
        isCancelled: true,
      }),
    ]
    expect(getOpenNowStatus(schedule, 'America/Chicago', NOW)).toEqual({ status: 'closed' })
  })

  it('matches a specificDate entry for the local calendar date, independent of dayOfWeek', () => {
    const schedule = [
      entry({
        dayOfWeek: null,
        specificDate: '2026-01-05T00:00:00.000Z',
        startTime: '1970-01-01T19:00:00.000Z',
        endTime: '1970-01-01T21:00:00.000Z',
      }),
    ]
    expect(getOpenNowStatus(schedule, 'America/Chicago', NOW).status).toBe('open')
  })

  it('the same instant and schedule produce different results in different timezones', () => {
    // Only a Monday entry — matches Chicago-local Monday, never matches Tokyo-local Tuesday.
    const schedule = [
      entry({ dayOfWeek: 1, startTime: '1970-01-01T19:00:00.000Z', endTime: '1970-01-01T21:00:00.000Z' }),
    ]
    expect(getOpenNowStatus(schedule, 'America/Chicago', NOW).status).toBe('open')
    expect(getOpenNowStatus(schedule, 'Asia/Tokyo', NOW).status).toBe('closed')
  })

  it('skips an entry missing a start or end time rather than throwing', () => {
    const schedule = [entry({ dayOfWeek: 1, startTime: null, endTime: null })]
    expect(getOpenNowStatus(schedule, 'America/Chicago', NOW)).toEqual({ status: 'closed' })
  })
})
