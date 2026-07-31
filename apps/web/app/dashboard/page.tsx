import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getOperatedTrucks } from '@/lib/operators'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  // Middleware already requires a session for /dashboard; user can only be
  // null here if the Clerk webhook hasn't synced yet.
  if (!user) {
    return <main className="mx-auto max-w-2xl p-8">Setting up your account — try again shortly.</main>
  }

  const trucks = await getOperatedTrucks(user.id)

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Your trucks</h1>

      {trucks.length === 0 ? (
        <div className="mt-6">
          <p className="text-gray-500">You don&apos;t operate any trucks yet.</p>
          <Link
            href="/dashboard/new"
            className="mt-3 inline-block rounded bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Create your truck
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-2">
            {trucks.map((truck) => (
              <li key={truck.id}>
                <Link
                  href={`/dashboard/${truck.id}`}
                  className="flex items-center justify-between rounded border p-3 hover:bg-gray-50"
                >
                  <span className="font-medium">{truck.name}</span>
                  <span className="text-sm text-gray-500 capitalize">{truck.role}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/dashboard/new" className="mt-4 inline-block text-sm underline">
            + Create another truck
          </Link>
        </>
      )}
    </main>
  )
}
