import { describe, it, expect, vi, beforeEach } from 'vitest'

const queryRaw = vi.fn()
const findUnique = vi.fn()
const findMany = vi.fn()
const truckUpdate = vi.fn()
const truckDelete = vi.fn()
const txTruckCreate = vi.fn()
const txTruckOperatorCreate = vi.fn()
const txUserUpdate = vi.fn()
const deleteCloudflareImage = vi.fn()
const extractCloudflareImageId = vi.fn()

const tx = {
  truck: { create: txTruckCreate },
  truckOperator: { create: txTruckOperatorCreate },
  user: { update: txUserUpdate },
}
const transaction = vi.fn((callback: (txArg: typeof tx) => unknown) => callback(tx))

vi.mock('@chomp/db', () => ({
  db: {
    $queryRaw: queryRaw,
    $transaction: transaction,
    truck: { findUnique, findMany, update: truckUpdate, delete: truckDelete },
  },
}))

vi.mock('./storage', () => ({ deleteCloudflareImage, extractCloudflareImageId }))

const {
  getNearbyTrucks,
  getTruckBySlug,
  createTruck,
  getTruckForEdit,
  updateTruckProfile,
  getAllTrucksForAdmin,
  verifyTruck,
  rejectTruck,
  holdTruck,
  deleteTruck,
  isValidTruckName,
  isValidTruckDescription,
  isValidCuisineType,
  MAX_TRUCK_NAME_LENGTH,
} = await import('./trucks')

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
        isFavorited: false,
        averageRating: 4.5,
        reviewCount: 12,
      },
    ]
    queryRaw.mockResolvedValue(rows)

    const result = await getNearbyTrucks(30.2672, -97.7431, 5000)

    expect(result).toEqual(rows)
    expect(queryRaw).toHaveBeenCalledTimes(1)
  })

  it('only queries verified, active trucks', async () => {
    queryRaw.mockResolvedValue([])
    await getNearbyTrucks(30.2672, -97.7431, 5000)

    const sql = (queryRaw.mock.calls.at(0)?.at(0) as string[]).join('')
    expect(sql).toContain('t.is_active = true')
    expect(sql).toContain("t.verification_status = 'verified'")
  })

  it('excludes trucks whose location freshness window has lapsed', async () => {
    queryRaw.mockResolvedValue([])
    await getNearbyTrucks(30.2672, -97.7431, 5000)

    const sql = (queryRaw.mock.calls.at(0)?.at(0) as string[]).join('')
    expect(sql).toContain('tl.expires_at IS NULL OR tl.expires_at > now()')
  })

  it('LEFT JOINs a visible-reviews-only rating aggregate, keyed by truck', async () => {
    queryRaw.mockResolvedValue([])
    await getNearbyTrucks(30.2672, -97.7431, 5000)

    const sql = (queryRaw.mock.calls.at(0)?.at(0) as string[]).join('')
    expect(sql).toContain('AVG(rating)')
    expect(sql).toContain('WHERE is_visible = true')
    expect(sql).toContain('GROUP BY truck_id')
    expect(sql).toContain('averageRating')
    expect(sql).toContain('reviewCount')
  })

  it('LEFT JOINs truck_favorites so a viewer sees isFavorited without excluding unfavorited trucks', async () => {
    queryRaw.mockResolvedValue([])
    await getNearbyTrucks(30.2672, -97.7431, 5000, 'u1')

    const call = queryRaw.mock.calls.at(0) ?? []
    const sql = (call.at(0) as string[]).join('')
    expect(sql).toContain('LEFT JOIN truck_favorites')
    expect(sql).toContain('isFavorited')
    // Tagged-template args are [strings, ...interpolatedValues] in the order
    // they appear in the template: lng, lat, viewerId, lng, lat, radius.
    expect(call).toContain('u1')
  })

  it('passes null for viewerId when signed out, rather than omitting the join entirely', async () => {
    queryRaw.mockResolvedValue([])
    await getNearbyTrucks(30.2672, -97.7431, 5000)

    const call = queryRaw.mock.calls.at(0) ?? []
    expect(call).toContain(null)
  })
})

describe('getTruckBySlug', () => {
  beforeEach(() => {
    findUnique.mockReset()
    queryRaw.mockReset()
    queryRaw.mockResolvedValue([])
  })

  it('returns null when no active truck matches the slug', async () => {
    findUnique.mockResolvedValue(null)

    const result = await getTruckBySlug('does-not-exist')

    expect(result).toBeNull()
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'does-not-exist', isActive: true, verificationStatus: 'verified' },
      }),
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
      locations: [
        {
          address: '123 Main St',
          reportedAt: new Date('2026-01-01T00:00:00Z'),
          expiresAt: new Date('2026-01-01T06:00:00Z'),
        },
      ],
      favorites: [],
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
      menuCategories: [
        {
          id: 'c1',
          name: 'Tacos',
          items: [
            {
              id: 'i1',
              name: 'Al Pastor',
              description: 'Pork, pineapple',
              price: { toNumber: () => 4.5 },
              imageUrl: null,
              isFeatured: true,
              isAvailable: true,
              dietaryFlags: ['spicy'],
              favorites: [],
            },
          ],
        },
      ],
    })

    queryRaw.mockResolvedValue([{ lat: 30.27, lng: -97.74 }])

    const result = await getTruckBySlug('taco-kings')

    expect(result?.currentAddress).toBe('123 Main St')
    expect(result?.locationReportedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(result?.locationExpiresAt).toBe('2026-01-01T06:00:00.000Z')
    expect(result?.locationLat).toBe(30.27)
    expect(result?.locationLng).toBe(-97.74)
    expect(result?.schedule).toHaveLength(1)
    expect(result?.schedule.at(0)?.locationNote).toBe('Corner of 5th')
    expect(result?.menu).toHaveLength(1)
    expect(result?.menu.at(0)?.items.at(0)?.price).toBe(4.5)
  })

  it('returns null locationReportedAt/locationExpiresAt when there is no current location row', async () => {
    findUnique.mockResolvedValue({
      id: 't1',
      slug: 'taco-kings',
      name: 'Taco Kings',
      description: null,
      cuisineType: [],
      phone: null,
      website: null,
      instagram: null,
      logoUrl: null,
      coverUrl: null,
      locations: [],
      favorites: [],
      schedules: [],
      menuCategories: [],
    })

    const result = await getTruckBySlug('taco-kings')

    expect(result?.locationReportedAt).toBeNull()
    expect(result?.locationExpiresAt).toBeNull()
    expect(result?.locationLat).toBeNull()
    expect(result?.locationLng).toBeNull()
    expect(queryRaw).not.toHaveBeenCalled()
  })

  it('maps isFavorited true/false for the truck and each menu item based on the favorites include', async () => {
    findUnique.mockResolvedValue({
      id: 't1',
      slug: 'taco-kings',
      name: 'Taco Kings',
      description: null,
      cuisineType: [],
      phone: null,
      website: null,
      instagram: null,
      logoUrl: null,
      coverUrl: null,
      locations: [],
      favorites: [{ truckId: 't1', userId: 'u1' }],
      schedules: [],
      menuCategories: [
        {
          id: 'c1',
          name: 'Tacos',
          items: [
            {
              id: 'i1',
              name: 'Al Pastor',
              description: null,
              price: null,
              imageUrl: null,
              isFeatured: false,
              isAvailable: true,
              dietaryFlags: [],
              favorites: [{ menuItemId: 'i1', userId: 'u1' }],
            },
            {
              id: 'i2',
              name: 'Carnitas',
              description: null,
              price: null,
              imageUrl: null,
              isFeatured: false,
              isAvailable: true,
              dietaryFlags: [],
              favorites: [],
            },
          ],
        },
      ],
    })

    const result = await getTruckBySlug('taco-kings', 'u1')

    expect(result?.isFavorited).toBe(true)
    expect(result?.menu[0]?.items[0]?.isFavorited).toBe(true)
    expect(result?.menu[0]?.items[1]?.isFavorited).toBe(false)
  })

  it('scopes the favorites include by viewerId, defaulting to an empty string when signed out', async () => {
    findUnique.mockResolvedValue({
      id: 't1',
      slug: 'taco-kings',
      name: 'Taco Kings',
      description: null,
      cuisineType: [],
      phone: null,
      website: null,
      instagram: null,
      logoUrl: null,
      coverUrl: null,
      locations: [],
      favorites: [],
      schedules: [],
      menuCategories: [],
    })

    await getTruckBySlug('taco-kings')

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          favorites: { where: { userId: '' } },
        }),
      }),
    )
  })

  it('queries only available items, ordered categories by displayOrder', async () => {
    findUnique.mockResolvedValue({
      id: 't1',
      slug: 'taco-kings',
      name: 'Taco Kings',
      description: null,
      cuisineType: [],
      phone: null,
      website: null,
      instagram: null,
      logoUrl: null,
      coverUrl: null,
      locations: [],
      favorites: [],
      schedules: [],
      menuCategories: [],
    })

    await getTruckBySlug('taco-kings')

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          menuCategories: expect.objectContaining({
            orderBy: { displayOrder: 'asc' },
            include: expect.objectContaining({
              items: expect.objectContaining({ where: { isAvailable: true } }),
            }),
          }),
        }),
      }),
    )
  })
})

describe('validation helpers', () => {
  it('isValidTruckName rejects empty/whitespace-only and over-length names', () => {
    expect(isValidTruckName('Taco Kings')).toBe(true)
    expect(isValidTruckName('')).toBe(false)
    expect(isValidTruckName('   ')).toBe(false)
    expect(isValidTruckName('a'.repeat(MAX_TRUCK_NAME_LENGTH + 1))).toBe(false)
  })

  it('isValidTruckDescription accepts null and rejects over-length text', () => {
    expect(isValidTruckDescription(null)).toBe(true)
    expect(isValidTruckDescription('a'.repeat(2001))).toBe(false)
  })

  it('isValidCuisineType caps list length and each entry length', () => {
    expect(isValidCuisineType(['mexican', 'fusion'])).toBe(true)
    expect(isValidCuisineType(Array(11).fill('x'))).toBe(false)
    expect(isValidCuisineType(['a'.repeat(31)])).toBe(false)
  })
})

describe('createTruck', () => {
  beforeEach(() => {
    findUnique.mockReset()
    transaction.mockClear()
    txTruckCreate.mockReset()
    txTruckOperatorCreate.mockReset()
    txUserUpdate.mockReset()
  })

  it('rejects an invalid name without starting a transaction', async () => {
    await expect(
      createTruck({ id: 'u1', role: 'customer' }, { name: '', description: null, cuisineType: [] }),
    ).rejects.toThrow('Invalid truck name')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('creates the truck, makes the caller its owner, and upgrades a customer to operator', async () => {
    findUnique.mockResolvedValue(null) // slug is free
    txTruckCreate.mockResolvedValue({ id: 't1', slug: 'taco-kings' })

    const result = await createTruck(
      { id: 'u1', role: 'customer' },
      { name: 'Taco Kings', description: null, cuisineType: ['mexican'] },
    )

    expect(result).toEqual({ id: 't1', slug: 'taco-kings' })
    expect(txTruckCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ownerId: 'u1', slug: 'taco-kings' }) }),
    )
    expect(txTruckOperatorCreate).toHaveBeenCalledWith({
      data: { truckId: 't1', userId: 'u1', role: 'owner' },
    })
    expect(txUserUpdate).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { role: 'operator' } })
  })

  it('does not touch role for a user who is already an operator', async () => {
    findUnique.mockResolvedValue(null)
    txTruckCreate.mockResolvedValue({ id: 't1', slug: 'taco-kings' })

    await createTruck(
      { id: 'u1', role: 'operator' },
      { name: 'Taco Kings', description: null, cuisineType: [] },
    )

    expect(txUserUpdate).not.toHaveBeenCalled()
  })

  it('appends a numeric suffix when the base slug is already taken', async () => {
    findUnique.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null)
    txTruckCreate.mockResolvedValue({ id: 't1', slug: 'taco-kings-2' })

    await createTruck(
      { id: 'u1', role: 'customer' },
      { name: 'Taco Kings', description: null, cuisineType: [] },
    )

    expect(txTruckCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'taco-kings-2' }) }),
    )
  })
})

describe('getTruckForEdit', () => {
  beforeEach(() => findUnique.mockReset())

  it('is not filtered by isActive, unlike getTruckBySlug', async () => {
    findUnique.mockResolvedValue(null)
    await getTruckForEdit('t1')

    expect(findUnique).toHaveBeenCalledWith({ where: { id: 't1' } })
  })

  it('returns null when the truck does not exist', async () => {
    findUnique.mockResolvedValue(null)
    expect(await getTruckForEdit('t1')).toBeNull()
  })

  it('includes verificationStatus and verificationNote for the dashboard status pill', async () => {
    findUnique.mockResolvedValue({
      id: 't1',
      slug: 'taco-kings',
      name: 'Taco Kings',
      description: null,
      cuisineType: [],
      phone: null,
      website: null,
      instagram: null,
      logoUrl: null,
      coverUrl: null,
      isActive: true,
      verificationStatus: 'rejected',
      verificationNote: 'Duplicate listing',
    })

    const result = await getTruckForEdit('t1')

    expect(result?.verificationStatus).toBe('rejected')
    expect(result?.verificationNote).toBe('Duplicate listing')
  })
})

describe('updateTruckProfile', () => {
  beforeEach(() => truckUpdate.mockReset())

  const validInput = {
    name: 'Taco Kings',
    description: null,
    cuisineType: ['mexican'],
    phone: null,
    website: null,
    instagram: null,
    logoUrl: null,
    coverUrl: null,
    isActive: true,
  }

  it('rejects an invalid name without touching the database', async () => {
    await expect(updateTruckProfile('t1', { ...validInput, name: '' })).rejects.toThrow(
      'Invalid truck name',
    )
    expect(truckUpdate).not.toHaveBeenCalled()
  })

  it('updates only the writable fields — never verificationStatus, verificationNote, ownerId, or slug', async () => {
    truckUpdate.mockResolvedValue({})
    await updateTruckProfile('t1', validInput)

    const call = truckUpdate.mock.calls.at(0)?.at(0)
    expect(call.where).toEqual({ id: 't1' })
    expect(call.data).not.toHaveProperty('verificationStatus')
    expect(call.data).not.toHaveProperty('verificationNote')
    expect(call.data).not.toHaveProperty('ownerId')
    expect(call.data).not.toHaveProperty('slug')
  })
})

describe('getAllTrucksForAdmin', () => {
  beforeEach(() => findMany.mockReset())

  it('returns every truck regardless of status, with the owner email', async () => {
    findMany.mockResolvedValue([
      {
        id: 't1',
        slug: 'taco-kings',
        name: 'Taco Kings',
        description: null,
        cuisineType: ['mexican'],
        phone: null,
        website: null,
        instagram: null,
        owner: { email: 'owner@example.com' },
        verificationStatus: 'pending',
        verificationNote: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    ])

    const result = await getAllTrucksForAdmin()

    expect(result).toEqual([
      expect.objectContaining({
        id: 't1',
        ownerEmail: 'owner@example.com',
        verificationStatus: 'pending',
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    ])
  })
})

describe('verifyTruck', () => {
  beforeEach(() => truckUpdate.mockReset())

  it('sets verified and clears any prior note', async () => {
    truckUpdate.mockResolvedValue({})
    await verifyTruck('t1')

    expect(truckUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { verificationStatus: 'verified', verificationNote: null },
    })
  })
})

describe('rejectTruck', () => {
  beforeEach(() => truckUpdate.mockReset())

  it('requires a non-empty reason, without writing', async () => {
    await expect(rejectTruck('t1', '   ')).rejects.toThrow('reason is required')
    expect(truckUpdate).not.toHaveBeenCalled()
  })

  it('sets rejected with the given reason', async () => {
    truckUpdate.mockResolvedValue({})
    await rejectTruck('t1', 'Fake business')

    expect(truckUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { verificationStatus: 'rejected', verificationNote: 'Fake business' },
    })
  })
})

describe('holdTruck', () => {
  beforeEach(() => truckUpdate.mockReset())

  it('requires a non-empty reason, without writing', async () => {
    await expect(holdTruck('t1', '')).rejects.toThrow('reason is required')
    expect(truckUpdate).not.toHaveBeenCalled()
  })

  it('sets onHold with the given reason', async () => {
    truckUpdate.mockResolvedValue({})
    await holdTruck('t1', 'Health code complaint')

    expect(truckUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { verificationStatus: 'onHold', verificationNote: 'Health code complaint' },
    })
  })
})

describe('deleteTruck', () => {
  beforeEach(() => {
    findUnique.mockReset()
    truckDelete.mockReset().mockResolvedValue({})
    deleteCloudflareImage.mockReset()
    extractCloudflareImageId.mockReset()
  })

  it('throws when the truck does not exist, without deleting', async () => {
    findUnique.mockResolvedValue(null)
    await expect(deleteTruck('t1', 'Taco Kings')).rejects.toThrow('not found')
    expect(truckDelete).not.toHaveBeenCalled()
  })

  it('rejects a name that does not match, without deleting', async () => {
    findUnique.mockResolvedValue({
      name: 'Taco Kings',
      logoUrl: null,
      coverUrl: null,
      menuItems: [],
      reviewPhotos: [],
    })
    await expect(deleteTruck('t1', 'Taco King')).rejects.toThrow('does not match')
    expect(truckDelete).not.toHaveBeenCalled()
  })

  it('trims the confirmed name before comparing', async () => {
    findUnique.mockResolvedValue({
      name: 'Taco Kings',
      logoUrl: null,
      coverUrl: null,
      menuItems: [],
      reviewPhotos: [],
    })
    await deleteTruck('t1', '  Taco Kings  ')
    expect(truckDelete).toHaveBeenCalledWith({ where: { id: 't1' } })
  })

  it('deletes the truck, then best-effort cleans up every Cloudflare Images asset', async () => {
    findUnique.mockResolvedValue({
      name: 'Taco Kings',
      logoUrl: 'https://imagedelivery.net/x/logo-id/public',
      coverUrl: 'https://imagedelivery.net/x/cover-id/public',
      menuItems: [{ imageUrl: 'https://imagedelivery.net/x/item-id/public' }, { imageUrl: null }],
      reviewPhotos: [{ url: 'https://imagedelivery.net/x/photo-id/public' }],
    })
    extractCloudflareImageId.mockImplementation((url: string) => url.split('/').at(-2) ?? null)

    await deleteTruck('t1', 'Taco Kings')

    expect(truckDelete).toHaveBeenCalledWith({ where: { id: 't1' } })
    expect(deleteCloudflareImage).toHaveBeenCalledWith('logo-id')
    expect(deleteCloudflareImage).toHaveBeenCalledWith('cover-id')
    expect(deleteCloudflareImage).toHaveBeenCalledWith('item-id')
    expect(deleteCloudflareImage).toHaveBeenCalledWith('photo-id')
    expect(deleteCloudflareImage).toHaveBeenCalledTimes(4)
  })

  it('skips Cloudflare cleanup entirely when the truck has no images', async () => {
    findUnique.mockResolvedValue({
      name: 'Taco Kings',
      logoUrl: null,
      coverUrl: null,
      menuItems: [],
      reviewPhotos: [],
    })

    await deleteTruck('t1', 'Taco Kings')

    expect(deleteCloudflareImage).not.toHaveBeenCalled()
  })

  it('gathers Cloudflare asset URLs before the delete, since the rows are gone afterward', async () => {
    const calls: string[] = []
    findUnique.mockImplementation(async () => {
      calls.push('findUnique')
      return { name: 'Taco Kings', logoUrl: null, coverUrl: null, menuItems: [], reviewPhotos: [] }
    })
    truckDelete.mockImplementation(async () => {
      calls.push('delete')
      return {}
    })

    await deleteTruck('t1', 'Taco Kings')

    expect(calls).toEqual(['findUnique', 'delete'])
  })
})
