'use server'

import { revalidatePath } from 'next/cache'
import type { MenuCategoryInput, MenuItemInput } from '@chomp/types'
import { requireOperator } from '@/lib/operators'
import {
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  deleteMenuItem,
  updateMenuCategory,
  updateMenuItem,
} from '@/lib/menu'

function revalidateMenu(truckId: string, slug: string) {
  revalidatePath(`/dashboard/${truckId}/menu`)
  revalidatePath(`/trucks/${slug}`)
}

export async function createMenuCategoryAction(
  truckId: string,
  slug: string,
  input: MenuCategoryInput,
): Promise<void> {
  await requireOperator(truckId)
  await createMenuCategory(truckId, input)
  revalidateMenu(truckId, slug)
}

export async function updateMenuCategoryAction(
  truckId: string,
  slug: string,
  categoryId: string,
  input: MenuCategoryInput,
): Promise<void> {
  await requireOperator(truckId)
  await updateMenuCategory(truckId, categoryId, input)
  revalidateMenu(truckId, slug)
}

export async function deleteMenuCategoryAction(
  truckId: string,
  slug: string,
  categoryId: string,
): Promise<void> {
  await requireOperator(truckId)
  await deleteMenuCategory(truckId, categoryId)
  revalidateMenu(truckId, slug)
}

export async function createMenuItemAction(
  truckId: string,
  slug: string,
  categoryId: string,
  input: MenuItemInput,
): Promise<void> {
  await requireOperator(truckId)
  await createMenuItem(truckId, categoryId, input)
  revalidateMenu(truckId, slug)
}

export async function updateMenuItemAction(
  truckId: string,
  slug: string,
  itemId: string,
  input: MenuItemInput,
): Promise<void> {
  await requireOperator(truckId)
  await updateMenuItem(truckId, itemId, input)
  revalidateMenu(truckId, slug)
}

export async function deleteMenuItemAction(
  truckId: string,
  slug: string,
  itemId: string,
): Promise<void> {
  await requireOperator(truckId)
  await deleteMenuItem(truckId, itemId)
  revalidateMenu(truckId, slug)
}
