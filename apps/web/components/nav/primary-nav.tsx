'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import type { NavLink } from '@chomp/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { NavLinkList } from './nav-link-list'

type Props = {
  navLinks: NavLink[]
}

/** Renders one navLinks source as an inline row on desktop and a drawer on mobile. */
export function PrimaryNav({ navLinks }: Props) {
  const [open, setOpen] = useState(false)
  const currentPath = usePathname()

  return (
    <>
      <nav className="hidden md:block" aria-label="Primary">
        <NavLinkList links={navLinks} currentPath={currentPath} orientation="horizontal" />
      </nav>

      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav aria-label="Primary" className="px-2">
            <NavLinkList
              links={navLinks}
              currentPath={currentPath}
              orientation="vertical"
              onNavigate={() => setOpen(false)}
            />
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
