import { describe, it, expect, vi, beforeEach } from 'vitest'

const queryRaw = vi.fn()
const findUnique = vi.fn()

vi.mock('@chomp/db', () => ({
  db: {
    $queryRaw: queryRaw,
    truck: { findUnique },
  },
}))

const { getNearbyTrucks, getTruckBySlug } = await import('./trucks')

describe('getNearbyTrucks', () => {
  beforeEach(() => {
    queryRaw.mockReset()
  })

  it('rejects invalid coordinates without querying the database', async () => {
    await expect(getNearbyTrucks(999, 0, 5000)).rejects.toThrow('Invalid coordinates')
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it('returns rows from the database for valid input', async () => {
    const rows = [
      {
        id: 't1',
        slug: 'taco-kings',
        name: 'Taco Kings',
        cuisineType: ['mexican'],
        logoUrl: null,
        lat: 30.27,
        lng: -97.74,
        distanceMeters: 500,
      },
    ]
    queryRaw.mockResolvedValue(rows)

    const result = await getNearbyTrucks(30.2672, -97.7431, 5000)

    expect(result).toEqual(rows)
    expect(queryRaw).toHaveBeenCalledTimes(1)
  })
})

describe('getTruckBySlug', () => {
  beforeEach(() => {
    findUnique.mockReset()
  })

  it('returns null when no active truck matches the slug', async () => {
    findUnique.mockResolvedValue(null)

    const result = await getTruckBySlug('does-not-exist')

    expect(result).toBeNull()
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'does-not-exist', isActive: true } }),
    )
  })

  it('maps a found truck, using the current location address and schedule', async () => {
    findUnique.mockResolvedValue({
      id: 't1',
      slug: 'taco-kings',
      name: 'Taco Kings',
      description: 'Tacos',
      cuisineType: ['mexican'],
      phone: null,
      website: null,
      instagram: null,
      logoUrl: null,
      coverUrl: null,
      locations: [{ address: '123 Main St' }],
      schedules: [
        {
          id: 's1',
          dayOfWeek: 3,
          specificDate: null,
          startTime: new Date('1970-01-01T11:00:00Z'),
          endTime: new Date('1970-01-01T14:00:00Z'),
          locationNote: 'Corner of 5th',
          address: null,
          isCancelled: false,
        },
      ],
    })

    const result = await getTruckBySlug('taco-kings')

    expect(result?.currentAddress).toBe('123 Main St')
    expect(result?.schedule).toHaveLength(1)
    expect(result?.schedule.at(0)?.locationNote).toBe('Corner of 5th')
  })
})
