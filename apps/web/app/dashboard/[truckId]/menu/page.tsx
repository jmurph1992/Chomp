import { notFound } from 'next/navigation'
import { getTruckForEdit } from '@/lib/trucks'
import { getMenuForEdit } from '@/lib/menu'
import { TruckMenuEditor } from '@/components/dashboard/truck-menu-editor'

export default async function TruckMenuPage({
  params,
}: {
  params: Promise<{ truckId: string }>
}) {
  const { truckId } = await params
  const truck = await getTruckForEdit(truckId)
  if (!truck) notFound()

  const menu = await getMenuForEdit(truckId)

  return <TruckMenuEditor truckId={truckId} slug={truck.slug} menu={menu} />
}
