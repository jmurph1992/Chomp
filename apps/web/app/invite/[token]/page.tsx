import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getInvitePreview } from '@/lib/invites'
import { getCurrentUser } from '@/lib/auth'
import { InviteClaimButton } from '@/components/invite-claim-button'

const STATUS_MESSAGE: Record<'accepted' | 'cancelled' | 'expired', string> = {
  accepted: 'This invite has already been accepted.',
  cancelled: 'This invite was cancelled.',
  expired: 'This invite has expired.',
}

export default async function InviteClaimPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const preview = await getInvitePreview(token)
  if (!preview) notFound()

  // Preview status can lag reality — expiry is only written lazily on an
  // actual claim attempt (see lib/invites.ts#claimInvite) — so also check
  // the timestamp directly rather than waiting for a claim attempt to
  // surface an invite that's technically already stale.
  const isExpired = preview.status === 'pending' && new Date(preview.expiresAt) < new Date()
  const terminalStatus = isExpired
    ? 'expired'
    : preview.status !== 'pending'
      ? (preview.status as 'accepted' | 'cancelled' | 'expired')
      : null

  const user = await getCurrentUser()

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Join {preview.truckName} on Chomp</h1>

      {terminalStatus ? (
        <p className="mt-4 text-gray-500">{STATUS_MESSAGE[terminalStatus]}</p>
      ) : user ? (
        <>
          <p className="mt-4 text-gray-500">
            You've been invited to help manage {preview.truckName}.
          </p>
          <InviteClaimButton token={token} />
        </>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-gray-500">
            You've been invited to help manage {preview.truckName}. Sign in or create an account
            with the email this invite was sent to, then come back to this link to accept.
          </p>
          <div className="flex gap-4 text-sm">
            <Link href={`/sign-up?redirect_url=/invite/${token}`} className="underline">
              Sign up
            </Link>
            <Link href={`/sign-in?redirect_url=/invite/${token}`} className="underline">
              Sign in
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}
