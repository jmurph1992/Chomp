import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { geocodeAddress } from './geocoding'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.test'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('geocodeAddress', () => {
  it('returns null when no Mapbox token is configured', async () => {
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    expect(await geocodeAddress('123 Main St')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the top match as { lat, lng }', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ center: [-97.7431, 30.2672] }] }),
    })

    expect(await geocodeAddress('123 Main St')).toEqual({ lat: 30.2672, lng: -97.7431 })
  })

  it('returns null when there are no matching features', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ features: [] }) })
    expect(await geocodeAddress('nonsense address')).toBeNull()
  })

  it('returns null on a non-2xx response', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    expect(await geocodeAddress('123 Main St')).toBeNull()
  })

  it('returns null when fetch itself throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    expect(await geocodeAddress('123 Main St')).toBeNull()
  })
})
