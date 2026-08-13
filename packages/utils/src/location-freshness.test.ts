import { describe, it, expect } from 'vitest'
import {
  DURATION_PRESETS,
  MAX_LOCATION_DURATION_HOURS,
  endOfLocalDay,
  expiresAtForPreset,
  isLocationActive,
  isValidExpiresAt,
} from './location-freshness'

describe('DURATION_PRESETS', () => {
  it('has the six expected presets, in order, with allDay carrying null minutes', () => {
    expect(DURATION_PRESETS.map((p) => p.id)).toEqual(['1h', '2h', '3h', '4h', '6h', 'allDay'])
    expect(DURATION_PRESETS.find((p) => p.id === 'allDay')?.minutes).toBeNull()
    expect(DURATION_PRESETS.filter((p) => p.id !== 'allDay').every((p) => typeof p.minutes === 'number')).toBe(true)
  })
})

describe('endOfLocalDay', () => {
  it('returns 23:59:59.999 on the same local calendar day', () => {
    const now = new Date(2026, 7, 13, 9, 30, 0)
    const end = endOfLocalDay(now)
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(7)
    expect(end.getDate()).toBe(13)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
    expect(end.getMilliseconds()).toBe(999)
  })
})

describe('expiresAtForPreset', () => {
  it.each([
    ['1h', 60],
    ['2h', 120],
    ['3h', 180],
    ['4h', 240],
    ['6h', 360],
  ] as const)('resolves %s to exactly now + %d minutes', (presetId, minutes) => {
    const now = new Date(2026, 7, 13, 9, 30, 0)
    const result = expiresAtForPreset(presetId, now)
    expect(result.getTime() - now.getTime()).toBe(minutes * 60_000)
  })

  it('resolves allDay to ~2 minutes later when posted at 11:58pm (same day)', () => {
    const now = new Date(2026, 7, 13, 23, 58, 0)
    const result = expiresAtForPreset('allDay', now)
    expect(result.getDate()).toBe(13)
    expect(result.getTime() - now.getTime()).toBeCloseTo(2 * 60_000, -3)
  })

  it('resolves allDay to ~23h58m later when posted at 12:01am (still same day)', () => {
    const now = new Date(2026, 7, 13, 0, 1, 0)
    const result = expiresAtForPreset('allDay', now)
    expect(result.getDate()).toBe(13)
    const expectedMs = (23 * 60 + 58) * 60_000 + 59_999
    expect(result.getTime() - now.getTime()).toBeCloseTo(expectedMs, -3)
  })
})

describe('isValidExpiresAt', () => {
  const now = new Date(2026, 7, 13, 12, 0, 0)

  it('rejects an unparseable value', () => {
    expect(isValidExpiresAt('not-a-date', now)).toBe(false)
  })

  it('rejects a non-future value', () => {
    expect(isValidExpiresAt(now.toISOString(), now)).toBe(false)
    expect(isValidExpiresAt(new Date(now.getTime() - 1000).toISOString(), now)).toBe(false)
  })

  it('rejects a value more than 48 hours out', () => {
    const tooFar = new Date(now.getTime() + (MAX_LOCATION_DURATION_HOURS + 1) * 60 * 60 * 1000)
    expect(isValidExpiresAt(tooFar.toISOString(), now)).toBe(false)
  })

  it('accepts a value 47 hours out', () => {
    const ok = new Date(now.getTime() + 47 * 60 * 60 * 1000)
    expect(isValidExpiresAt(ok.toISOString(), now)).toBe(true)
  })
})

describe('isLocationActive', () => {
  const now = new Date(2026, 7, 13, 12, 0, 0)

  it('treats null as always active', () => {
    expect(isLocationActive(null, now)).toBe(true)
  })

  it('treats a future expiry as active', () => {
    expect(isLocationActive(new Date(now.getTime() + 1000).toISOString(), now)).toBe(true)
  })

  it('treats a past expiry as not active', () => {
    expect(isLocationActive(new Date(now.getTime() - 1000).toISOString(), now)).toBe(false)
  })

  it('treats an expiry exactly at now as not active (exclusive comparison)', () => {
    expect(isLocationActive(now.toISOString(), now)).toBe(false)
  })
})
