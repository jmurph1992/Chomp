import { describe, it, expect } from 'vitest'
import { getUniqueDietaryFlags, filterMenuByDietaryFlags } from './menu'
import type { MenuCategoryView, MenuItemView } from '@chomp/types'

function item(overrides: Partial<MenuItemView>): MenuItemView {
  return {
    id: 'item_1',
    name: 'Item',
    description: null,
    price: 10,
    imageUrl: null,
    isFeatured: false,
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
