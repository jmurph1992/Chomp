import Link from 'next/link'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'
import type { NavLink } from '@chomp/utils'
import { isDemoMode, signupUrl } from '@/lib/demo'
import { PrimaryNav } from './primary-nav'

type Props = {
  navLinks: NavLink[]
}

/** Server component — role data is resolved by the caller and passed in via navLinks. */
export function SiteHeader({ navLinks }: Props) {
  const demo = isDemoMode()

  return (
    <header className="flex items-center justify-between gap-4 border-b p-4">
      <Link href="/" className="font-display text-lg tracking-wide text-primary">
        Chomp
      </Link>

      <div className="flex items-center gap-4">
        <PrimaryNav navLinks={navLinks} />
        {demo ? (
          <a href={signupUrl()} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            Sign up
          </a>
        ) : (
          <>
            <SignedOut>
              <SignInButton mode="modal" />
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </>
        )}
      </div>
    </header>
  )
}
