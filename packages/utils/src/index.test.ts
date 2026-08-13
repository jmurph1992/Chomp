import { describe, it, expect } from 'vitest'
import { slugify, formatPrice, formatUsd, formatDistanceMiles, isValidRating } from './index'

describe('slugify', () => {
  it('lowercases, strips punctuation, and hyphenates', () => {
    expect(slugify("Taco King's!")).toBe('taco-kings')
  })
})

describe('formatPrice', () => {
  it('formats integer cents as a dollar string', () => {
    expect(formatPrice(1250)).toBe('$12.50')
  })
})

describe('formatUsd', () => {
  it('formats a dollar amount directly, without dividing by 100', () => {
    expect(formatUsd(12.5)).toBe('$12.50')
    expect(formatUsd(3)).toBe('$3.00')
  })
})

describe('formatDistanceMiles', () => {
  it('converts meters to miles with one decimal place', () => {
    expect(formatDistanceMiles(804.672)).toBe('0.5 mi')
    expect(formatDistanceMiles(1609.344)).toBe('1.0 mi')
  })
})

describe('isValidRating', () => {
  it('accepts integers 1-5', () => {
    expect(isValidRating(1)).toBe(true)
    expect(isValidRating(5)).toBe(true)
  })

  it('rejects out-of-range, non-integer, or non-numeric values', () => {
    expect(isValidRating(0)).toBe(false)
    expect(isValidRating(6)).toBe(false)
    expect(isValidRating(3.5)).toBe(false)
    expect(isValidRating('3')).toBe(false)
  })
})
