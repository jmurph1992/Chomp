'use client'

import type { ReactNode } from 'react'
import { SignedIn } from '@clerk/nextjs'
import { isDemoMode } from '@/lib/demo'

/**
 * Drop-in replacement for Clerk's <SignedIn> for write-only affordances that
 * should just disappear in demo mode, rather than throw — the demo
 * deployment has no ClerkProvider mounted at all (see /lib/demo.ts), and
 * <SignedIn> throws if rendered outside one. Use this instead of <SignedIn>
 * anywhere the demo behavior should be "hide it"; components that need a
 * different demo fallback (a signup CTA, a read-only count) branch on
 * isDemoMode() directly instead.
 */
export function SignedInSafe({ children }: { children: ReactNode }) {
  if (isDemoMode()) return null
  return <SignedIn>{children}</SignedIn>
}
