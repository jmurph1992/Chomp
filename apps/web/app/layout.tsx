import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Geist } from 'next/font/google'
import { getNavLinksForUser } from '@chomp/utils'
import { cn } from '@/lib/utils'
import { getCurrentUser } from '@/lib/auth'
import { getOperatedTrucks } from '@/lib/operators'
import { SiteHeader } from '@/components/nav/site-header'
import { NavHistoryTracker } from '@/components/nav/nav-history-tracker'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

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

  return (
    <ClerkProvider>
      <html lang="en" className={cn('font-sans', geist.variable)}>
        <body className="antialiased">
          <NavHistoryTracker />
          <SiteHeader navLinks={navLinks} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
