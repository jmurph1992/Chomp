'use server'

import { revalidatePath } from 'next/cache'
import type { ScheduleEntryInput } from '@chomp/types'
import { requireOperator } from '@/lib/operators'
import { createScheduleEntry, deleteScheduleEntry, updateScheduleEntry } from '@/lib/schedule'

function revalidateSchedule(truckId: string, slug: string) {
  revalidatePath(`/dashboard/${truckId}/schedule`)
  revalidatePath(`/trucks/${slug}`)
}

export async function createScheduleEntryAction(
  truckId: string,
  slug: string,
  input: ScheduleEntryInput,
): Promise<void> {
  await requireOperator(truckId)
  await createScheduleEntry(truckId, input)
  revalidateSchedule(truckId, slug)
}

export async function updateScheduleEntryAction(
  truckId: string,
  slug: string,
  entryId: string,
  input: ScheduleEntryInput,
): Promise<void> {
  await requireOperator(truckId)
  await updateScheduleEntry(truckId, entryId, input)
  revalidateSchedule(truckId, slug)
}

export async function deleteScheduleEntryAction(
  truckId: string,
  slug: string,
  entryId: string,
): Promise<void> {
  await requireOperator(truckId)
  await deleteScheduleEntry(truckId, entryId)
  revalidateSchedule(truckId, slug)
}
