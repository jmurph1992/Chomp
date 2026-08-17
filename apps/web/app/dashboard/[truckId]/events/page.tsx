import { notFound } from 'next/navigation'
import { getTruckForEdit } from '@/lib/trucks'
import { getEventsForEdit } from '@/lib/events'
import { TruckEventsEditor } from '@/components/dashboard/truck-events-editor'

export default async function TruckEventsPage({
  params,
}: {
  params: Promise<{ truckId: string }>
}) {
  const { truckId } = await params
  const truck = await getTruckForEdit(truckId)
  if (!truck) notFound()

  const events = await getEventsForEdit(truckId)

  return <TruckEventsEditor truckId={truckId} slug={truck.slug} events={events} />
}
