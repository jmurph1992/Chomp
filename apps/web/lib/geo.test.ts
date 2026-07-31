import { describe, it, expect } from 'vitest'
import { isValidLat, isValidLng, clampRadiusMeters, MAX_RADIUS_METERS, DEFAULT_RADIUS_METERS } from './geo'

describe('isValidLat', () => {
  it('accepts values within -90..90', () => {
    expect(isValidLat(0)).toBe(true)
    expect(isValidLat(-90)).toBe(true)
    expect(isValidLat(90)).toBe(true)
  })

  it('rejects out-of-range or non-numeric values', () => {
    expect(isValidLat(90.1)).toBe(false)
    expect(isValidLat(-90.1)).toBe(false)
    expect(isValidLat(NaN)).toBe(false)
    expect(isValidLat('30')).toBe(false)
    expect(isValidLat(undefined)).toBe(false)
  })
})

describe('isValidLng', () => {
  it('accepts values within -180..180', () => {
    expect(isValidLng(0)).toBe(true)
    expect(isValidLng(-180)).toBe(true)
    expect(isValidLng(180)).toBe(true)
  })

  it('rejects out-of-range or non-numeric values', () => {
    expect(isValidLng(180.1)).toBe(false)
    expect(isValidLng(-180.1)).toBe(false)
    expect(isValidLng(NaN)).toBe(false)
  })
})

describe('clampRadiusMeters', () => {
  it('passes through valid values under the cap', () => {
    expect(clampRadiusMeters(5000)).toBe(5000)
  })

  it('caps values above MAX_RADIUS_METERS', () => {
    expect(clampRadiusMeters(MAX_RADIUS_METERS * 10)).toBe(MAX_RADIUS_METERS)
  })

  it('falls back to the default for zero, negative, or non-finite input', () => {
    expect(clampRadiusMeters(0)).toBe(DEFAULT_RADIUS_METERS)
    expect(clampRadiusMeters(-100)).toBe(DEFAULT_RADIUS_METERS)
    expect(clampRadiusMeters(NaN)).toBe(DEFAULT_RADIUS_METERS)
  })
})
