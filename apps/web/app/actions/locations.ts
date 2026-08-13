'use server'

import { revalidatePath } from 'next/cache'
import type { PostLocationInput } from '@chomp/types'
import { requireOperator } from '@/lib/operators'
import { postLocation, extendLocation } from '@/lib/locations'

export async function postLocationAction(
  truckId: string,
  slug: string,
  input: PostLocationInput,
): Promise<void> {
  await requireOperator(truckId)
  await postLocation(truckId, input)
  revalidatePath(`/dashboard/${truckId}/location`)
  revalidatePath('/')
  revalidatePath(`/trucks/${slug}`)
}

export async function extendLocationAction(
  truckId: string,
  slug: string,
  expiresAt: string,
): Promise<void> {
  await requireOperator(truckId)
  await extendLocation(truckId, expiresAt)
  revalidatePath(`/dashboard/${truckId}/location`)
  revalidatePath('/')
  revalidatePath(`/trucks/${slug}`)
}
