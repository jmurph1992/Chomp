'use server'

import { revalidatePath } from 'next/cache'
import type { TruckEventInput } from '@chomp/types'
import { createEvent, deleteEvent, updateEvent } from '@/lib/events'
import { requireOperator } from '@/lib/operators'
import { checkRateLimit, eventLimiter } from '@/lib/rate-limit'

function revalidateEvents(truckId: string, slug: string) {
  revalidatePath(`/dashboard/${truckId}/events`)
  revalidatePath(`/trucks/${slug}`)
  revalidatePath('/feed')
}

export async function createEventAction(
  truckId: string,
  slug: string,
  input: TruckEventInput,
): Promise<void> {
  const { user } = await requireOperator(truckId)
  await checkRateLimit(eventLimiter, user.id)

  await createEvent(truckId, input)
  revalidateEvents(truckId, slug)
}

export async function updateEventAction(
  truckId: string,
  slug: string,
  eventId: string,
  input: TruckEventInput,
): Promise<void> {
  await requireOperator(truckId)
  await updateEvent(truckId, eventId, input)
  revalidateEvents(truckId, slug)
}

export async function deleteEventAction(truckId: string, slug: string, eventId: string): Promise<void> {
  await requireOperator(truckId)
  await deleteEvent(truckId, eventId)
  revalidateEvents(truckId, slug)
}
