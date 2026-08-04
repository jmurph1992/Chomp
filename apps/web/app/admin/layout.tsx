import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'

/**
 * Gates the entire /admin subtree. Every nested page still needs
 * requireAdmin() in its own server actions (this only protects rendering the
 * pages) — same two-layer shape as /dashboard/[truckId]'s requireOperator.
 * 404s rather than redirecting to sign-in, so a non-admin can't tell an
 * admin section exists at all.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin().catch(() => null)
  if (!user) notFound()

  return <div className="mx-auto max-w-4xl p-8">{children}</div>
}
