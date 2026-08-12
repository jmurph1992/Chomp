import Link from 'next/link'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'
import type { NavLink } from '@chomp/utils'
import { PrimaryNav } from './primary-nav'

type Props = {
  navLinks: NavLink[]
}

/** Server component — role data is resolved by the caller and passed in via navLinks. */
export function SiteHeader({ navLinks }: Props) {
  return (
    <header className="flex items-center justify-between gap-4 border-b p-4">
      <Link href="/" className="text-sm font-semibold">
        Chomp
      </Link>

      <div className="flex items-center gap-4">
        <PrimaryNav navLinks={navLinks} />
        <SignedOut>
          <SignInButton mode="modal" />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </header>
  )
}
