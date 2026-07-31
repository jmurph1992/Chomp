import { db } from '@chomp/db'
import type { MenuCategoryInput, MenuCategoryView, MenuItemInput } from '@chomp/types'

/** All distinct dietary flags across a truck's menu, for building filter chips. */
export function getUniqueDietaryFlags(menu: MenuCategoryView[]): string[] {
  const flags = new Set<string>()
  for (const category of menu) {
    for (const item of category.items) {
      for (const flag of item.dietaryFlags) flags.add(flag)
    }
  }
  return [...flags].sort()
}

/**
 * Keeps only items matching every selected flag (AND, not OR) — dietary
 * restrictions compose ("vegan" and "gluten-free" both required), they don't
 * widen results the way an OR filter would. Categories with no matching items
 * are dropped entirely. An empty selection returns the menu unchanged.
 */
export function filterMenuByDietaryFlags(
  menu: MenuCategoryView[],
  activeFlags: string[],
): MenuCategoryView[] {
  if (activeFlags.length === 0) return menu

  return menu
    .map((category) => ({
      ...category,
      items: category.items.filter((item) =>
        activeFlags.every((flag) => item.dietaryFlags.includes(flag)),
      ),
    }))
    .filter((category) => category.items.length > 0)
}

/**
 * Full menu for the dashboard editor — unlike the public read in
 * lib/trucks.ts#getTruckBySlug, includes unavailable items (the operator
 * needs to see and toggle them, not just customers seeing what's on offer).
 */
export async function getMenuForEdit(truckId: string): Promise<MenuCategoryView[]> {
  const categories = await db.menuCategory.findMany({
    where: { truckId },
    orderBy: { displayOrder: 'asc' },
    include: { items: { orderBy: { createdAt: 'asc' } } },
  })

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    items: category.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price ? item.price.toNumber() : null,
      imageUrl: item.imageUrl,
      isFeatured: item.isFeatured,
      isAvailable: item.isAvailable,
      dietaryFlags: item.dietaryFlags,
    })),
  }))
}

// ─── Dashboard CRUD ───────────────────────────────────────────────────────────
//
// Every mutation below is scoped by truckId, not just the category/item's own
// id — an operator authorized for truckId A must not be able to touch a
// category/item belonging to truck B by passing its id. Functions that would
// otherwise use a plain unique `where` instead use updateMany/deleteMany (or
// an explicit findFirst check first) so the truckId filter actually applies,
// and treat "0 rows affected" as "not found or not yours" — same error either way.

export async function createMenuCategory(truckId: string, input: MenuCategoryInput) {
  const displayOrder = await db.menuCategory.count({ where: { truckId } })
  return db.menuCategory.create({
    data: { truckId, name: input.name, displayOrder },
  })
}

export async function updateMenuCategory(
  truckId: string,
  categoryId: string,
  input: MenuCategoryInput,
): Promise<void> {
  const result = await db.menuCategory.updateMany({
    where: { id: categoryId, truckId },
    data: { name: input.name },
  })
  if (result.count === 0) throw new Error('Menu category not found')
}

export async function deleteMenuCategory(truckId: string, categoryId: string): Promise<void> {
  const category = await db.menuCategory.findFirst({
    where: { id: categoryId, truckId },
    include: { _count: { select: { items: true } } },
  })
  if (!category) throw new Error('Menu category not found')
  if (category._count.items > 0) {
    throw new Error('Delete or move this category\'s items before deleting it')
  }
  await db.menuCategory.delete({ where: { id: categoryId } })
}

export async function createMenuItem(truckId: string, categoryId: string, input: MenuItemInput) {
  const category = await db.menuCategory.findFirst({ where: { id: categoryId, truckId } })
  if (!category) throw new Error('Menu category not found')

  return db.menuItem.create({
    data: {
      truckId,
      categoryId,
      name: input.name,
      description: input.description,
      price: input.price,
      imageUrl: input.imageUrl,
      isAvailable: input.isAvailable,
      isFeatured: input.isFeatured,
      dietaryFlags: input.dietaryFlags,
    },
  })
}

export async function updateMenuItem(
  truckId: string,
  itemId: string,
  input: MenuItemInput,
): Promise<void> {
  const result = await db.menuItem.updateMany({
    where: { id: itemId, truckId },
    data: {
      name: input.name,
      description: input.description,
      price: input.price,
      imageUrl: input.imageUrl,
      isAvailable: input.isAvailable,
      isFeatured: input.isFeatured,
      dietaryFlags: input.dietaryFlags,
    },
  })
  if (result.count === 0) throw new Error('Menu item not found')
}

export async function deleteMenuItem(truckId: string, itemId: string): Promise<void> {
  const result = await db.menuItem.deleteMany({ where: { id: itemId, truckId } })
  if (result.count === 0) throw new Error('Menu item not found')
}
