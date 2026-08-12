/**
 * Single source of truth for the operator dashboard's tab row, shared with
 * the breadcrumb trail so the two never drift out of sync.
 */

export type DashboardTab = { slug: '' | 'menu' | 'schedule' | 'location' | 'team'; label: string }

export const DASHBOARD_TABS: DashboardTab[] = [
  { slug: '', label: 'Profile' },
  { slug: 'menu', label: 'Menu' },
  { slug: 'schedule', label: 'Schedule' },
  { slug: 'location', label: 'Location' },
  { slug: 'team', label: 'Team' },
]

export function dashboardTabHref(truckId: string, tab: DashboardTab): string {
  return tab.slug ? `/dashboard/${truckId}/${tab.slug}` : `/dashboard/${truckId}`
}

/** Returns the tab whose href matches `pathname` exactly, or undefined. */
export function getActiveDashboardTab(
  pathname: string,
  truckId: string,
): DashboardTab | undefined {
  return DASHBOARD_TABS.find((tab) => dashboardTabHref(truckId, tab) === pathname)
}
