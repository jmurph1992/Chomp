import { describe, it, expect, vi, beforeEach } from 'vitest'

const truckFavoriteUpsert = vi.fn()
const truckFavoriteDeleteMany = vi.fn()
const truckFavoriteFindMany = vi.fn()
const menuItemFavoriteUpsert = vi.fn()
const menuItemFavoriteDeleteMany = vi.fn()
const menuItemFavoriteFindMany = vi.fn()
const menuItemFindFirst = vi.fn()

vi.mock('@chomp/db', () => ({
  db: {
    truckFavorite: {
      upsert: truckFavoriteUpsert,
      deleteMany: truckFavoriteDeleteMany,
      findMany: truckFavoriteFindMany,
    },
    menuItemFavorite: {
      upsert: menuItemFavoriteUpsert,
      deleteMany: menuItemFavoriteDeleteMany,
      findMany: menuItemFavoriteFindMany,
    },
    menuItem: { findFirst: menuItemFindFirst },
  },
}))

const {
  favoriteTruck,
  unfavoriteTruck,
  favoriteMenuItem,
  unfavoriteMenuItem,
  getFavoriteTrucksForUser,
  getFavoriteMenuItemsForUser,
} = await import('./favorites')

beforeEach(() => {
  truckFavoriteUpsert.mockReset().mockResolvedValue({})
  truckFavoriteDeleteMany.mockReset()
  truckFavoriteFindMany.mockReset()
  menuItemFavoriteUpsert.mockReset().mockResolvedValue({})
  menuItemFavoriteDeleteMany.mockReset()
  menuItemFavoriteFindMany.mockReset()
  menuItemFindFirst.mockReset()
})

describe('favoriteTruck', () => {
  it('upserts idempotently, keyed by the composite truckId_userId', async () => {
    await favoriteTruck('u1', 't1')
    expect(truckFavoriteUpsert).toHaveBeenCalledWith({
      where: { truckId_userId: { truckId: 't1', userId: 'u1' } },
      create: { truckId: 't1', userId: 'u1' },
      update: {},
    })
  })
})

describe('unfavoriteTruck', () => {
  it('deletes scoped by both truckId and userId', async () => {
    truckFavoriteDeleteMany.mockResolvedValue({ count: 1 })
    await unfavoriteTruck('u1', 't1')
    expect(truckFavoriteDeleteMany).toHaveBeenCalledWith({ where: { truckId: 't1', userId: 'u1' } })
  })

  it('is a no-op, not an error, when nothing was favorited', async () => {
    truckFavoriteDeleteMany.mockResolvedValue({ count: 0 })
    await expect(unfavoriteTruck('u1', 't1')).resolves.toBeUndefined()
  })
})

describe('favoriteMenuItem', () => {
  it('rejects a menuItemId that does not belong to truckId, without upserting — the IDOR case', async () => {
    menuItemFindFirst.mockResolvedValue(null)
    await expect(favoriteMenuItem('u1', 't1', 'item-from-another-truck')).rejects.toThrow(
      'not found',
    )
    expect(menuItemFavoriteUpsert).not.toHaveBeenCalled()
  })

  it('upserts idempotently for a menu item that does belong to truckId', async () => {
    menuItemFindFirst.mockResolvedValue({ id: 'i1', truckId: 't1' })
    await favoriteMenuItem('u1', 't1', 'i1')

    expect(menuItemFindFirst).toHaveBeenCalledWith({ where: { id: 'i1', truckId: 't1' } })
    expect(menuItemFavoriteUpsert).toHaveBeenCalledWith({
      where: { menuItemId_userId: { menuItemId: 'i1', userId: 'u1' } },
      create: { menuItemId: 'i1', userId: 'u1' },
      update: {},
    })
  })
})

describe('unfavoriteMenuItem', () => {
  it('deletes scoped by menuItemId, userId, and the item belonging to truckId', async () => {
    menuItemFavoriteDeleteMany.mockResolvedValue({ count: 1 })
    await unfavoriteMenuItem('u1', 't1', 'i1')
    expect(menuItemFavoriteDeleteMany).toHaveBeenCalledWith({
      where: { menuItemId: 'i1', userId: 'u1', menuItem: { truckId: 't1' } },
    })
  })
})

describe('getFavoriteTrucksForUser', () => {
  it('scopes by userId, newest first, and maps the truck fields', async () => {
    truckFavoriteFindMany.mockResolvedValue([
      {
        truck: {
          id: 't1',
          slug: 'taco-kings',
          name: 'Taco Kings',
          logoUrl: 'https://example.com/logo.png',
          cuisineType: ['mexican'],
        },
      },
    ])

    const result = await getFavoriteTrucksForUser('u1')

    expect(truckFavoriteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' }, orderBy: { createdAt: 'desc' } }),
    )
    expect(result).toEqual([
      {
        truckId: 't1',
        truckSlug: 'taco-kings',
        truckName: 'Taco Kings',
        logoUrl: 'https://example.com/logo.png',
        cuisineType: ['mexican'],
      },
    ])
  })
})

describe('getFavoriteMenuItemsForUser', () => {
  it('scopes by userId, newest first, and maps the item + its truck', async () => {
    menuItemFavoriteFindMany.mockResolvedValue([
      {
        menuItem: {
          id: 'i1',
          truckId: 't1',
          name: 'Al Pastor',
          price: { toNumber: () => 4.5 },
          imageUrl: null,
          truck: { slug: 'taco-kings', name: 'Taco Kings' },
        },
      },
    ])

    const result = await getFavoriteMenuItemsForUser('u1')

    expect(menuItemFavoriteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' }, orderBy: { createdAt: 'desc' } }),
    )
    expect(result).toEqual([
      {
        menuItemId: 'i1',
        truckId: 't1',
        name: 'Al Pastor',
        price: 4.5,
        imageUrl: null,
        truckSlug: 'taco-kings',
        truckName: 'Taco Kings',
      },
    ])
  })

  it('maps a null price straight through', async () => {
    menuItemFavoriteFindMany.mockResolvedValue([
      {
        menuItem: {
          id: 'i1',
          truckId: 't1',
          name: 'Al Pastor',
          price: null,
          imageUrl: null,
          truck: { slug: 'taco-kings', name: 'Taco Kings' },
        },
      },
    ])

    const result = await getFavoriteMenuItemsForUser('u1')
    expect(result[0]?.price).toBeNull()
  })
})
