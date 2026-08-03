import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireOperator = vi.fn()
const createMenuCategory = vi.fn()
const updateMenuCategory = vi.fn()
const deleteMenuCategory = vi.fn()
const createMenuItem = vi.fn()
const updateMenuItem = vi.fn()
const deleteMenuItem = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/operators', () => ({ requireOperator }))
vi.mock('@/lib/menu', () => ({
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
}))
vi.mock('next/cache', () => ({ revalidatePath }))

const {
  createMenuCategoryAction,
  updateMenuCategoryAction,
  deleteMenuCategoryAction,
  createMenuItemAction,
  updateMenuItemAction,
  deleteMenuItemAction,
} = await import('./menu')

beforeEach(() => {
  requireOperator.mockReset()
  createMenuCategory.mockReset()
  updateMenuCategory.mockReset()
  deleteMenuCategory.mockReset()
  createMenuItem.mockReset()
  updateMenuItem.mockReset()
  deleteMenuItem.mockReset()
})

const NOT_AUTHORIZED = new Error('Not authorized to manage this truck')

describe('menu actions', () => {
  it('createMenuCategoryAction rejects an unauthorized caller before writing', async () => {
    requireOperator.mockRejectedValue(NOT_AUTHORIZED)
    await expect(
      createMenuCategoryAction('t1', 'slug', { name: 'Tacos' }),
    ).rejects.toThrow('Not authorized')
    expect(createMenuCategory).not.toHaveBeenCalled()
  })

  it('createMenuCategoryAction delegates for an authorized operator', async () => {
    requireOperator.mockResolvedValue({ role: 'owner' })
    createMenuCategory.mockResolvedValue({})
    await createMenuCategoryAction('t1', 'slug', { name: 'Tacos' })
    expect(createMenuCategory).toHaveBeenCalledWith('t1', { name: 'Tacos' })
  })

  it('updateMenuCategoryAction rejects an unauthorized caller before writing', async () => {
    requireOperator.mockRejectedValue(NOT_AUTHORIZED)
    await expect(
      updateMenuCategoryAction('t1', 'slug', 'c1', { name: 'Tacos' }),
    ).rejects.toThrow('Not authorized')
    expect(updateMenuCategory).not.toHaveBeenCalled()
  })

  it('deleteMenuCategoryAction rejects an unauthorized caller before deleting', async () => {
    requireOperator.mockRejectedValue(NOT_AUTHORIZED)
    await expect(deleteMenuCategoryAction('t1', 'slug', 'c1')).rejects.toThrow('Not authorized')
    expect(deleteMenuCategory).not.toHaveBeenCalled()
  })

  it('createMenuItemAction rejects an unauthorized caller before writing', async () => {
    requireOperator.mockRejectedValue(NOT_AUTHORIZED)
    await expect(
      createMenuItemAction('t1', 'slug', 'c1', {
        name: 'Al Pastor',
        description: null,
        price: 4.5,
        imageUrl: null,
        isAvailable: true,
        isFeatured: false,
        dietaryFlags: [],
      }),
    ).rejects.toThrow('Not authorized')
    expect(createMenuItem).not.toHaveBeenCalled()
  })

  it('updateMenuItemAction rejects an unauthorized caller before writing', async () => {
    requireOperator.mockRejectedValue(NOT_AUTHORIZED)
    await expect(
      updateMenuItemAction('t1', 'slug', 'i1', {
        name: 'Al Pastor',
        description: null,
        price: 4.5,
        imageUrl: null,
        isAvailable: true,
        isFeatured: false,
        dietaryFlags: [],
      }),
    ).rejects.toThrow('Not authorized')
    expect(updateMenuItem).not.toHaveBeenCalled()
  })

  it('deleteMenuItemAction rejects an unauthorized caller before deleting', async () => {
    requireOperator.mockRejectedValue(NOT_AUTHORIZED)
    await expect(deleteMenuItemAction('t1', 'slug', 'i1')).rejects.toThrow('Not authorized')
    expect(deleteMenuItem).not.toHaveBeenCalled()
  })
})
