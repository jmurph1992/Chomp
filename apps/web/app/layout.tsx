import type { Metadata } from 'next'
import './globals.css'

/**
 * Root layout — wraps every page in the app.
 * Clerk <ClerkProvider> will be added here once auth is wired up.
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
