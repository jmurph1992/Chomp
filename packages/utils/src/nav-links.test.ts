import { describe, it, expect } from 'vitest'
import { getNavLinksForUser, BASE_NAV_LINKS } from './nav-links'

describe('getNavLinksForUser', () => {
  it('returns only the base links for a signed-out visitor', () => {
    expect(getNavLinksForUser(null, false)).toEqual(BASE_NAV_LINKS)
  })

  it('adds Account but not Dashboard/Admin for a signed-in customer', () => {
    const links = getNavLinksForUser({ role: 'customer' }, false)
    expect(links.map((l) => l.label)).toEqual(['Map', 'Feed', 'Account'])
  })

  it('adds Dashboard for a user who operates at least one truck', () => {
    const links = getNavLinksForUser({ role: 'customer' }, true)
    expect(links.map((l) => l.label)).toEqual(['Map', 'Feed', 'Dashboard', 'Account'])
    expect(links.find((l) => l.label === 'Dashboard')).toEqual({
      href: '/dashboard',
      label: 'Dashboard',
    })
  })

  it('adds Admin for a user with the admin role, regardless of operator status', () => {
    const links = getNavLinksForUser({ role: 'admin' }, false)
    expect(links.map((l) => l.label)).toEqual(['Map', 'Feed', 'Admin', 'Account'])
  })

  it('adds both Dashboard and Admin, in that order, for an admin who also operates a truck', () => {
    const links = getNavLinksForUser({ role: 'admin' }, true)
    expect(links.map((l) => l.label)).toEqual(['Map', 'Feed', 'Dashboard', 'Admin', 'Account'])
  })
})
