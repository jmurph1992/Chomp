import { isDemoMode, signupUrl } from '@/lib/demo'

/**
 * Shown only on the read-only public demo deployment, so a visitor always
 * knows this is sample data and where to go to use the real thing.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null

  return (
    <div className="bg-marigold px-4 py-2 text-center text-sm text-griddle">
      You&apos;re browsing a live demo with sample data.{' '}
      <a href={signupUrl()} className="font-medium underline underline-offset-2">
        Sign up on the real app
      </a>{' '}
      to save favorites, leave reviews, and manage your own truck.
    </div>
  )
}
