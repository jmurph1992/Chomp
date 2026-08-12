import { describe, it, expect } from 'vitest'
import { getActiveDashboardTab, dashboardTabHref, DASHBOARD_TABS } from './dashboard-tabs'

describe('dashboardTabHref', () => {
  it('omits the slug segment for the Profile tab', () => {
    expect(dashboardTabHref('truck-1', DASHBOARD_TABS[0])).toBe('/dashboard/truck-1')
  })

  it('includes the slug segment for other tabs', () => {
    const menuTab = DASHBOARD_TABS.find((t) => t.slug === 'menu')!
    expect(dashboardTabHref('truck-1', menuTab)).toBe('/dashboard/truck-1/menu')
  })
})

describe('getActiveDashboardTab', () => {
  it.each(DASHBOARD_TABS.map((tab) => [tab.label, tab] as const))(
    'matches the %s tab by its exact path',
    (_label, tab) => {
      const href = dashboardTabHref('truck-1', tab)
      expect(getActiveDashboardTab(href, 'truck-1')).toEqual(tab)
    },
  )

  it('returns undefined for an unrelated path', () => {
    expect(getActiveDashboardTab('/dashboard/truck-1/menu/edit', 'truck-1')).toBeUndefined()
    expect(getActiveDashboardTab('/dashboard/truck-2', 'truck-1')).toBeUndefined()
  })
})
