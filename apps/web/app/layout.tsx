import type { Metadata } from 'next'
import Link from 'next/link'
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'
import './globals.css'

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="antialiased">
          <header className="flex items-center justify-end gap-4 p-4">
            <SignedOut>
              <SignInButton mode="modal" />
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="text-sm underline">
                Dashboard
              </Link>
              <UserButton />
            </SignedIn>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
