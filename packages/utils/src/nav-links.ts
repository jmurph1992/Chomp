/**
 * Resolves which site-wide nav links a given viewer should see.
 * Pure/framework-agnostic so it can be reused by a future native client.
 */

export type NavLink = { href: string; label: string }

/** Links every visitor sees, signed in or not. */
export const BASE_NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Map' },
  { href: '/feed', label: 'Feed' },
]

/**
 * `user` is the minimal shape needed here (not the full DB row) so this
 * package stays dependency-free of `@chomp/db`. `isOperator` must be
 * resolved by the caller (e.g. via `getOperatedTrucks(user.id).length > 0`)
 * since "operates at least one truck" isn't a property on `user` itself.
 */
export function getNavLinksForUser(
  user: { role: string } | null,
  isOperator: boolean,
): NavLink[] {
  if (!user) return BASE_NAV_LINKS

  const links = [...BASE_NAV_LINKS]
  if (isOperator) links.push({ href: '/dashboard', label: 'Dashboard' })
  if (user.role === 'admin') links.push({ href: '/admin/trucks', label: 'Admin' })
  links.push({ href: '/account', label: 'Account' })

  return links
}
