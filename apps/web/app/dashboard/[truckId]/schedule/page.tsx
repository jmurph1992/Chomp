import { notFound } from 'next/navigation'
import { getTruckForEdit } from '@/lib/trucks'
import { getScheduleForEdit } from '@/lib/schedule'
import { TruckScheduleEditor } from '@/components/dashboard/truck-schedule-editor'

export default async function TruckSchedulePage({
  params,
}: {
  params: Promise<{ truckId: string }>
}) {
  const { truckId } = await params
  const truck = await getTruckForEdit(truckId)
  if (!truck) notFound()

  const schedule = await getScheduleForEdit(truckId)

  return <TruckScheduleEditor truckId={truckId} slug={truck.slug} schedule={schedule} />
}
