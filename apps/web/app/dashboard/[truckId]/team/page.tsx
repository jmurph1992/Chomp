import { notFound } from 'next/navigation'
import { getPendingOwner, listInvitesForTruck, listManagers } from '@/lib/invites'
import { requireOperator } from '@/lib/operators'
import { TeamManager } from '@/components/dashboard/team-manager'

export default async function TruckTeamPage({
  params,
}: {
  params: Promise<{ truckId: string }>
}) {
  const { truckId } = await params

  // The layout already gates rendering via requireOperator, but doesn't
  // thread `role`/`user` down to children — re-resolved here since this page
  // needs them to decide whether to show owner-only controls, and whether the
  // viewer is themselves the target of a pending ownership offer.
  const { user, role } = await requireOperator(truckId).catch(() => ({ user: null, role: null }))
  if (!user) notFound()

  const isOwner = role === 'owner'

  const [managers, invites, pendingOwner] = await Promise.all([
    listManagers(truckId),
    listInvitesForTruck(truckId),
    getPendingOwner(truckId),
  ])

  return (
    <TeamManager
      truckId={truckId}
      isOwner={isOwner}
      managers={managers}
      invites={invites}
      pendingOwner={isOwner ? pendingOwner : null}
      isPendingTarget={pendingOwner?.userId === user.id}
    />
  )
}
