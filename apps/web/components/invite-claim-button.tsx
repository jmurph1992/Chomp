'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { claimInviteAction } from '@/app/actions/invites'

/**
 * Requires an explicit click rather than auto-firing on page load — a stale
 * or forwarded link shouldn't silently enroll a signed-in visitor who merely
 * landed on the page.
 */
export function InviteClaimButton({ token }: { token: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function accept() {
    setError(null)
    startTransition(async () => {
      try {
        const { truckId } = await claimInviteAction(token)
        router.push(`/dashboard/${truckId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div className="mt-4">
      <button
        onClick={accept}
        disabled={isPending}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        Accept invite
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
