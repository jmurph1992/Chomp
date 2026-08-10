import { notFound } from 'next/navigation'
import { getTruckForEdit } from '@/lib/trucks'
import { requireOperator } from '@/lib/operators'
import { TruckProfileForm } from '@/components/dashboard/truck-profile-form'
import { DeleteTruckSection } from '@/components/dashboard/delete-truck-section'

// Authorization is enforced by the parent layout (requireOperator) — re-resolved
// here (same pattern as team/page.tsx) since the layout doesn't thread `role`
// down, and this page needs it to decide whether to show the owner-only
// delete section.
export default async function TruckProfilePage({
  params,
}: {
  params: Promise<{ truckId: string }>
}) {
  const { truckId } = await params
  const { role } = await requireOperator(truckId).catch(() => ({ role: null }))
  if (!role) notFound()

  const truck = await getTruckForEdit(truckId)
  if (!truck) notFound()

  return (
    <>
      <TruckProfileForm truck={truck} />
      {role === 'owner' && <DeleteTruckSection truckId={truck.id} truckName={truck.name} />}
    </>
  )
}
