import Link from 'next/link'
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

  return (
    <div className="mx-auto max-w-4xl p-8">
      <nav className="flex gap-4 border-b text-sm">
        <Link href="/admin/trucks" className="pb-2">
          Trucks
        </Link>
        <Link href="/admin/reviews" className="pb-2">
          Reviews
        </Link>
        <Link href="/admin/reports" className="pb-2">
          Reports
        </Link>
        <Link href="/admin/users" className="pb-2">
          Users
        </Link>
        <Link href="/admin/moderation" className="pb-2">
          Moderation
        </Link>
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  )
}
