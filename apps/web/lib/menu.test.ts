import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MenuCategoryView, MenuItemView } from '@chomp/types'

const findMany = vi.fn()
const count = vi.fn()
const categoryCreate = vi.fn()
const categoryUpdateMany = vi.fn()
const categoryFindFirst = vi.fn()
const categoryDelete = vi.fn()
const itemCreate = vi.fn()
const itemUpdateMany = vi.fn()
const itemDeleteMany = vi.fn()

vi.mock('@chomp/db', () => ({
  db: {
    menuCategory: {
      findMany,
      count,
      create: categoryCreate,
      updateMany: categoryUpdateMany,
      findFirst: categoryFindFirst,
      delete: categoryDelete,
    },
    menuItem: { create: itemCreate, updateMany: itemUpdateMany, deleteMany: itemDeleteMany },
  },
}))

const {
  getUniqueDietaryFlags,
  filterMenuByDietaryFlags,
  getMenuForEdit,
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} = await import('./menu')

function item(overrides: Partial<MenuItemView>): MenuItemView {
  return {
    id: 'item_1',
    name: 'Item',
    description: null,
    price: 10,
    imageUrl: null,
    isFeatured: false,
    isAvailable: true,
    dietaryFlags: [],
    ...overrides,
  }
}

describe('getUniqueDietaryFlags', () => {
  it('returns distinct, sorted flags across all categories and items', () => {
    const menu: MenuCategoryView[] = [
      { id: 'c1', name: 'Tacos', items: [item({ dietaryFlags: ['vegan', 'spicy'] })] },
      { id: 'c2', name: 'Drinks', items: [item({ dietaryFlags: ['vegan'] })] },
    ]
    expect(getUniqueDietaryFlags(menu)).toEqual(['spicy', 'vegan'])
  })

  it('returns an empty array when no items have flags', () => {
    const menu: MenuCategoryView[] = [{ id: 'c1', name: 'Tacos', items: [item({})] }]
    expect(getUniqueDietaryFlags(menu)).toEqual([])
  })
})

describe('filterMenuByDietaryFlags', () => {
  const menu: MenuCategoryView[] = [
    {
      id: 'c1',
      name: 'Tacos',
      items: [
        item({ id: 'i1', dietaryFlags: ['vegan', 'gluten-free'] }),
        item({ id: 'i2', dietaryFlags: ['vegan'] }),
        item({ id: 'i3', dietaryFlags: [] }),
      ],
    },
  ]

  it('returns the menu unchanged when no flags are active', () => {
    expect(filterMenuByDietaryFlags(menu, [])).toEqual(menu)
  })

  it('keeps only items matching every selected flag (AND, not OR)', () => {
    const result = filterMenuByDietaryFlags(menu, ['vegan', 'gluten-free'])
    expect(result).toHaveLength(1)
    expect(result[0]!.items.map((i) => i.id)).toEqual(['i1'])
  })

  it('drops categories with no matching items', () => {
    const result = filterMenuByDietaryFlags(menu, ['nut-free'])
    expect(result).toHaveLength(0)
  })
})

describe('getMenuForEdit', () => {
  beforeEach(() => findMany.mockReset())

  it('is not filtered by isAvailable, unlike the public read', async () => {
    findMany.mockResolvedValue([])
    await getMenuForEdit('t1')

    const call = findMany.mock.calls.at(0)?.at(0)
    expect(call.where).toEqual({ truckId: 't1' })
    expect(call.include.items).not.toHaveProperty('where')
  })
})

describe('createMenuCategory', () => {
  beforeEach(() => {
    count.mockReset()
    categoryCreate.mockReset()
  })

  it('sets displayOrder to the current category count (append to end)', async () => {
    count.mockResolvedValue(2)
    categoryCreate.mockResolvedValue({})

    await createMenuCategory('t1', { name: 'Drinks' })

    expect(categoryCreate).toHaveBeenCalledWith({
      data: { truckId: 't1', name: 'Drinks', displayOrder: 2 },
    })
  })
})

describe('updateMenuCategory', () => {
  beforeEach(() => categoryUpdateMany.mockReset())

  it('scopes the update by truckId, not just categoryId', async () => {
    categoryUpdateMany.mockResolvedValue({ count: 1 })
    await updateMenuCategory('t1', 'c1', { name: 'Tacos' })

    expect(categoryUpdateMany).toHaveBeenCalledWith({
      where: { id: 'c1', truckId: 't1' },
      data: { name: 'Tacos' },
    })
  })

  it('throws when the category does not belong to this truck (0 rows affected)', async () => {
    categoryUpdateMany.mockResolvedValue({ count: 0 })
    await expect(updateMenuCategory('t1', 'c1', { name: 'Tacos' })).rejects.toThrow('not found')
  })
})

describe('deleteMenuCategory', () => {
  beforeEach(() => {
    categoryFindFirst.mockReset()
    categoryDelete.mockReset()
  })

  it('throws when the category does not belong to this truck', async () => {
    categoryFindFirst.mockResolvedValue(null)
    await expect(deleteMenuCategory('t1', 'c1')).rejects.toThrow('not found')
    expect(categoryDelete).not.toHaveBeenCalled()
  })

  it('blocks deleting a non-empty category with a clear error, not a raw FK error', async () => {
    categoryFindFirst.mockResolvedValue({ id: 'c1', _count: { items: 2 } })
    await expect(deleteMenuCategory('t1', 'c1')).rejects.toThrow('items')
    expect(categoryDelete).not.toHaveBeenCalled()
  })

  it('deletes an empty category owned by this truck', async () => {
    categoryFindFirst.mockResolvedValue({ id: 'c1', _count: { items: 0 } })
    categoryDelete.mockResolvedValue({})

    await deleteMenuCategory('t1', 'c1')

    expect(categoryDelete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })
})

const validItemInput = {
  name: 'Al Pastor',
  description: null,
  price: 4.5,
  imageUrl: null,
  isAvailable: true,
  isFeatured: false,
  dietaryFlags: [],
}

describe('createMenuItem', () => {
  beforeEach(() => {
    categoryFindFirst.mockReset()
    itemCreate.mockReset()
  })

  it('rejects when the category does not belong to this truck', async () => {
    categoryFindFirst.mockResolvedValue(null)
    await expect(createMenuItem('t1', 'c1', validItemInput)).rejects.toThrow('not found')
    expect(itemCreate).not.toHaveBeenCalled()
  })

  it('creates the item under a category confirmed to belong to this truck', async () => {
    categoryFindFirst.mockResolvedValue({ id: 'c1' })
    itemCreate.mockResolvedValue({})

    await createMenuItem('t1', 'c1', validItemInput)

    expect(categoryFindFirst).toHaveBeenCalledWith({ where: { id: 'c1', truckId: 't1' } })
    expect(itemCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ truckId: 't1', categoryId: 'c1' }) }),
    )
  })
})

describe('updateMenuItem', () => {
  beforeEach(() => itemUpdateMany.mockReset())

  it('scopes the update by truckId, not just itemId', async () => {
    itemUpdateMany.mockResolvedValue({ count: 1 })
    await updateMenuItem('t1', 'i1', validItemInput)

    const call = itemUpdateMany.mock.calls.at(0)?.at(0)
    expect(call.where).toEqual({ id: 'i1', truckId: 't1' })
  })

  it('throws when the item does not belong to this truck', async () => {
    itemUpdateMany.mockResolvedValue({ count: 0 })
    await expect(updateMenuItem('t1', 'i1', validItemInput)).rejects.toThrow('not found')
  })
})

describe('deleteMenuItem', () => {
  beforeEach(() => itemDeleteMany.mockReset())

  it('scopes the delete by truckId, not just itemId', async () => {
    itemDeleteMany.mockResolvedValue({ count: 1 })
    await deleteMenuItem('t1', 'i1')
    expect(itemDeleteMany).toHaveBeenCalledWith({ where: { id: 'i1', truckId: 't1' } })
  })

  it('throws when the item does not belong to this truck', async () => {
    itemDeleteMany.mockResolvedValue({ count: 0 })
    await expect(deleteMenuItem('t1', 'i1')).rejects.toThrow('not found')
  })
})
