import { notFound } from 'next/navigation'
import { getTruckForEdit } from '@/lib/trucks'
import { TruckProfileForm } from '@/components/dashboard/truck-profile-form'

// Authorization is enforced by the parent layout (requireOperator) — this
// page only needs the truck's data to render the form.
export default async function TruckProfilePage({
  params,
}: {
  params: Promise<{ truckId: string }>
}) {
  const { truckId } = await params
  const truck = await getTruckForEdit(truckId)
  if (!truck) notFound()

  return <TruckProfileForm truck={truck} />
}
