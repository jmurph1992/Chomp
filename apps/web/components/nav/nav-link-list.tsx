import Link from 'next/link'
import type { NavLink } from '@chomp/utils'
import { cn } from '@/lib/utils'

type Props = {
  links: NavLink[]
  currentPath: string
  orientation: 'horizontal' | 'vertical'
  /** Called after a link is clicked — used to close the mobile drawer. */
  onNavigate?: () => void
}

/** True for an exact match, or a prefix match for any non-root link (so
 * `/` never matches every path via a naive startsWith check). */
function isActive(href: string, currentPath: string): boolean {
  if (href === '/') return currentPath === '/'
  return currentPath === href || currentPath.startsWith(`${href}/`)
}

export function NavLinkList({ links, currentPath, orientation, onNavigate }: Props) {
  return (
    <ul className={cn('flex gap-4', orientation === 'vertical' && 'flex-col gap-1')}>
      {links.map((link) => {
        const active = isActive(link.href, currentPath)
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? 'page' : undefined}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              className={cn(
                'text-sm font-medium text-muted-foreground hover:text-foreground',
                orientation === 'vertical' && 'block px-2 py-2',
                active && 'text-foreground',
              )}
            >
              {link.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
