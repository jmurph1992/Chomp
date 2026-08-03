import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireOperator, getOperatedTrucks } from '@/lib/operators'
import { getTruckForEdit } from '@/lib/trucks'
import { TruckSwitcher } from '@/components/dashboard/truck-switcher'

/**
 * Gates the entire /dashboard/[truckId] subtree. Every nested page still
 * needs requireOperator() in its own server actions (this only protects
 * rendering the pages, not the actions called from them) but this is where
 * a mismatched truckId gets caught before any page-specific content renders.
 */
export default async function TruckDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ truckId: string }>
}) {
  const { truckId } = await params

  const { user } = await requireOperator(truckId).catch(() => ({ user: null }))
  if (!user) notFound()

  const [truck, operatedTrucks] = await Promise.all([
    getTruckForEdit(truckId),
    getOperatedTrucks(user.id),
  ])
  if (!truck) notFound()

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{truck.name}</h1>
        <Link href={`/trucks/${truck.slug}`} className="text-sm underline">
          View public page
        </Link>
      </div>

      <TruckSwitcher trucks={operatedTrucks} currentTruckId={truckId} />

      <nav className="mt-4 flex gap-4 border-b text-sm">
        <Link href={`/dashboard/${truckId}`} className="pb-2">
          Profile
        </Link>
        <Link href={`/dashboard/${truckId}/menu`} className="pb-2">
          Menu
        </Link>
        <Link href={`/dashboard/${truckId}/schedule`} className="pb-2">
          Schedule
        </Link>
        <Link href={`/dashboard/${truckId}/location`} className="pb-2">
          Location
        </Link>
      </nav>

      <div className="mt-6">{children}</div>
    </div>
  )
}
