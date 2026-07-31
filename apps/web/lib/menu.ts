import type { MenuCategoryView } from '@chomp/types'

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
