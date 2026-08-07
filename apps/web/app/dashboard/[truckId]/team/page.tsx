import { notFound } from 'next/navigation'
import { listInvitesForTruck, listManagers } from '@/lib/invites'
import { requireOperator } from '@/lib/operators'
import { TeamManager } from '@/components/dashboard/team-manager'

export default async function TruckTeamPage({
  params,
}: {
  params: Promise<{ truckId: string }>
}) {
  const { truckId } = await params

  // The layout already gates rendering via requireOperator, but doesn't
  // thread `role` down to children — re-resolved here since this page needs
  // it to decide whether to show owner-only invite/remove controls.
  const { role } = await requireOperator(truckId).catch(() => ({ role: null }))
  if (!role) notFound()

  const [managers, invites] = await Promise.all([
    listManagers(truckId),
    listInvitesForTruck(truckId),
  ])

  return (
    <TeamManager truckId={truckId} isOwner={role === 'owner'} managers={managers} invites={invites} />
  )
}
