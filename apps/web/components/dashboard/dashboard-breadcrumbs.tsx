'use client'

import { usePathname } from 'next/navigation'
import { getActiveDashboardTab } from '@chomp/utils'
import { Breadcrumbs, type Crumb } from '@/components/nav/breadcrumbs'

type Props = {
  truckId: string
  truckName: string
}

export function DashboardBreadcrumbs({ truckId, truckName }: Props) {
  const pathname = usePathname()
  const activeTab = getActiveDashboardTab(pathname, truckId)

  const items: Crumb[] = [{ href: '/dashboard', label: 'Dashboard' }]

  if (activeTab && activeTab.slug !== '') {
    items.push({ href: `/dashboard/${truckId}`, label: truckName })
    items.push({ label: activeTab.label })
  } else {
    items.push({ label: truckName })
  }

  return <Breadcrumbs items={items} />
}
