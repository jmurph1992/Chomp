import { describe, it, expect, vi, beforeEach } from 'vitest'

const truckFindUnique = vi.fn()
const truckFavoriteFindMany = vi.fn()

vi.mock('@chomp/db', () => ({
  db: {
    truck: { findUnique: truckFindUnique },
    truckFavorite: { findMany: truckFavoriteFindMany },
  },
}))

const {
  getTruckNameAndSlug,
  getOptedInFavoriterEmails,
  activationEmailHtml,
  getEventNotifyOptedInEmails,
  newEventEmailHtml,
} = await import('./favorite-notifications')

beforeEach(() => {
  truckFindUnique.mockReset()
  truckFavoriteFindMany.mockReset()
  delete process.env.NEXT_PUBLIC_APP_URL
})

describe('getTruckNameAndSlug', () => {
  it('returns the truck name/slug', async () => {
    truckFindUnique.mockResolvedValue({ name: 'Taco Kings', slug: 'taco-kings' })

    const result = await getTruckNameAndSlug('t1')

    expect(result).toEqual({ name: 'Taco Kings', slug: 'taco-kings' })
    expect(truckFindUnique).toHaveBeenCalledWith({
      where: { id: 't1' },
      select: { name: true, slug: true },
    })
  })

  it('returns null when the truck no longer exists', async () => {
    truckFindUnique.mockResolvedValue(null)
    expect(await getTruckNameAndSlug('t1')).toBeNull()
  })
})

describe('getOptedInFavoriterEmails', () => {
  it('only queries favorites whose user has opted in', async () => {
    truckFavoriteFindMany.mockResolvedValue([])
    await getOptedInFavoriterEmails('t1')

    expect(truckFavoriteFindMany).toHaveBeenCalledWith({
      where: { truckId: 't1', user: { notifyFavoriteActive: true } },
      select: { user: { select: { email: true } } },
    })
  })

  it('flattens the result to a plain email array', async () => {
    truckFavoriteFindMany.mockResolvedValue([
      { user: { email: 'a@example.com' } },
      { user: { email: 'b@example.com' } },
    ])

    expect(await getOptedInFavoriterEmails('t1')).toEqual(['a@example.com', 'b@example.com'])
  })

  it('returns an empty array when nobody has opted in', async () => {
    truckFavoriteFindMany.mockResolvedValue([])
    expect(await getOptedInFavoriterEmails('t1')).toEqual([])
  })
})

describe('activationEmailHtml', () => {
  it('links to the truck page and the account preferences', () => {
    const html = activationEmailHtml({ name: 'Taco Kings', slug: 'taco-kings' })

    expect(html).toContain('Taco Kings')
    expect(html).toContain('http://localhost:3000/trucks/taco-kings')
    expect(html).toContain('http://localhost:3000/account')
  })
})

describe('getEventNotifyOptedInEmails', () => {
  it('only queries favorites with notifyNewEvents set, not the User-level flag', async () => {
    truckFavoriteFindMany.mockResolvedValue([])
    await getEventNotifyOptedInEmails('t1')

    expect(truckFavoriteFindMany).toHaveBeenCalledWith({
      where: { truckId: 't1', notifyNewEvents: true },
      select: { user: { select: { email: true } } },
    })
  })

  it('flattens the result to a plain email array', async () => {
    truckFavoriteFindMany.mockResolvedValue([{ user: { email: 'a@example.com' } }])
    expect(await getEventNotifyOptedInEmails('t1')).toEqual(['a@example.com'])
  })
})

describe('newEventEmailHtml', () => {
  it('links to the truck page and names the event', () => {
    const html = newEventEmailHtml({ name: 'Taco Kings', slug: 'taco-kings' }, { title: 'Pop-Up' })

    expect(html).toContain('Taco Kings')
    expect(html).toContain('Pop-Up')
    expect(html).toContain('http://localhost:3000/trucks/taco-kings')
  })
})
