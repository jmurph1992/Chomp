import { notFound } from 'next/navigation'
import { getTruckForEdit } from '@/lib/trucks'
import { getCurrentLocation } from '@/lib/locations'
import { TruckLocationForm } from '@/components/dashboard/truck-location-form'

export default async function TruckLocationPage({
  params,
}: {
  params: Promise<{ truckId: string }>
}) {
  const { truckId } = await params
  const truck = await getTruckForEdit(truckId)
  if (!truck) notFound()

  const currentLocation = await getCurrentLocation(truckId)

  return <TruckLocationForm truckId={truckId} slug={truck.slug} currentLocation={currentLocation} />
}
