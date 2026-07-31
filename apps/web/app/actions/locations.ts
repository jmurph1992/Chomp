'use server'

import { revalidatePath } from 'next/cache'
import type { PostLocationInput } from '@chomp/types'
import { requireOperator } from '@/lib/operators'
import { postLocation } from '@/lib/locations'

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
