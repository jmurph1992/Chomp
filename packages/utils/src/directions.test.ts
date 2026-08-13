import { describe, it, expect } from 'vitest'
import { buildDirectionsUrl } from './directions'

describe('buildDirectionsUrl', () => {
  it('prefers the address when present, URL-encoded', () => {
    const url = buildDirectionsUrl('123 Main St, Austin, TX', 30.27, -97.74)
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=123%20Main%20St%2C%20Austin%2C%20TX',
    )
  })

  it('falls back to coordinates when address is null', () => {
    const url = buildDirectionsUrl(null, 30.27, -97.74)
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=30.27%2C-97.74')
  })

  it('returns null when there is no address and no coordinates', () => {
    expect(buildDirectionsUrl(null, null, null)).toBeNull()
  })

  it('safely encodes special characters in the address, not string-concatenated raw', () => {
    const url = buildDirectionsUrl('5th & Main "Truck Alley"', null, null)
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=5th%20%26%20Main%20%22Truck%20Alley%22',
    )
    expect(url).not.toContain('&Main')
  })
})
