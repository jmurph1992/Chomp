'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteOwnAccountAction } from '@/app/actions/account'

type BlockingTruck = { id: string; name: string; slug: string }

/**
 * Same type-to-confirm gate as components/dashboard/delete-truck-section.tsx,
 * confirming the user's email instead of a truck name — the one thing every
 * user unambiguously knows, since there's no truck-name equivalent for a
 * personal account.
 *
 * If the user is the sole owner of any truck, the confirm input never
 * appears at all — same "can't even reach the dangerous action" gate
 * deleteTruckAction's canDelete flag provides, just resolved server-side
 * (findSoleOwnedTrucks, in app/account/[[...rest]]/page.tsx) before render
 * instead of client-side on submit.
 */
export function DeleteAccountSection({
  userEmail,
  blockingTrucks,
}: {
  userEmail: string
  blockingTrucks: BlockingTruck[]
}) {
  const router = useRouter()
  const [typedEmail, setTypedEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const canDelete = typedEmail.trim().toLowerCase() === userEmail.toLowerCase()

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      try {
        await deleteOwnAccountAction(typedEmail)
        router.push('/')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <section className="mt-8 max-w-md rounded border border-red-200 p-4">
      <h2 className="font-medium text-red-700">Danger zone</h2>

      {blockingTrucks.length > 0 ? (
        <div className="mt-1 text-sm text-gray-500">
          <p>
            You're the sole owner of {blockingTrucks.map((t) => t.name).join(', ')}. Transfer ownership
            or delete {blockingTrucks.length > 1 ? 'them' : 'it'} before you can delete your account.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {blockingTrucks.map((truck) => (
              <li key={truck.id}>
                <Link href={`/dashboard/${truck.id}/team`} className="underline">
                  {truck.name} — transfer ownership
                </Link>{' '}
                or{' '}
                <Link href={`/dashboard/${truck.id}`} className="underline">
                  delete it
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-500">
            Deleting your account is permanent. Your reviews and photos stay visible but are
            anonymized; your favorites, manager roles, and profile are removed.
          </p>
          <label className="mt-3 block text-sm font-medium">
            Type <span className="font-mono">{userEmail}</span> to confirm
          </label>
          <input
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            className="mt-1 w-full rounded border p-2 text-sm"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            onClick={handleDelete}
            disabled={!canDelete || isPending}
            className="mt-3 rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Delete my account
          </button>
        </>
      )}
    </section>
  )
}
