import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Anton, Geist, Geist_Mono } from 'next/font/google'
import { getNavLinksForUser } from '@chomp/utils'
import { cn } from '@/lib/utils'
import { getCurrentUser } from '@/lib/auth'
import { getOperatedTrucks } from '@/lib/operators'
import { isDemoMode } from '@/lib/demo'
import { SiteHeader } from '@/components/nav/site-header'
import { NavHistoryTracker } from '@/components/nav/nav-history-tracker'
import { DemoBanner } from '@/components/demo-banner'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })
// Anton only ships one weight — it's already the boldest possible cut, used
// sparingly (wordmark, page headings) rather than as a general text face.
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-display' })

/**
 * Root layout — wraps every page in the app.
 */
export const metadata: Metadata = {
  title: {
    default: 'Chomp',
    template: '%s | Chomp',
  },
  description: 'Find food trucks near you.',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()
  const operatedTrucks = user ? await getOperatedTrucks(user.id) : []
  const navLinks = getNavLinksForUser(user, operatedTrucks.length > 0)

  const body = (
    <html lang="en" className={cn('font-sans', geist.variable, geistMono.variable, anton.variable)}>
      <body className="antialiased">
        <NavHistoryTracker />
        <DemoBanner />
        <SiteHeader navLinks={navLinks} />
        {children}
      </body>
    </html>
  )

  // Demo mode has no Clerk keys configured at all — ClerkProvider itself
  // throws without a publishable key, so it's skipped entirely rather than
  // rendered with empty credentials.
  return isDemoMode() ? body : <ClerkProvider>{body}</ClerkProvider>
}
