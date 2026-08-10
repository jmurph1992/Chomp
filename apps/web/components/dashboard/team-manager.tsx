'use client'

import { useState, useTransition } from 'react'
import type { TruckInviteView, TruckManagerView } from '@chomp/types'
import {
  acceptTransferAction,
  cancelInviteAction,
  cancelTransferAction,
  createInviteAction,
  declineTransferAction,
  initiateTransferAction,
  removeManagerAction,
} from '@/app/actions/invites'

export function TeamManager({
  truckId,
  isOwner,
  managers,
  invites,
  pendingOwner,
  isPendingTarget,
}: {
  truckId: string
  isOwner: boolean
  managers: TruckManagerView[]
  invites: TruckInviteView[]
  pendingOwner: TruckManagerView | null
  isPendingTarget: boolean
}) {
  const pendingInvites = invites.filter((invite) => invite.status === 'pending')

  return (
    <div className="space-y-8">
      {isPendingTarget && <PendingTransferOffer truckId={truckId} />}

      {isOwner && <InviteForm truckId={truckId} />}

      <section>
        <h2 className="font-medium">Managers</h2>
        {isOwner && pendingOwner && <PendingTransferStatus truckId={truckId} pendingOwner={pendingOwner} />}
        {managers.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No managers yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {managers.map((manager) => (
              <ManagerRow
                key={manager.userId}
                truckId={truckId}
                manager={manager}
                isOwner={isOwner}
                canOfferOwnership={isOwner && !pendingOwner}
              />
            ))}
          </ul>
        )}
      </section>

      {isOwner && (
        <section>
          <h2 className="font-medium">Pending invites</h2>
          {pendingInvites.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No pending invites.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {pendingInvites.map((invite) => (
                <InviteRow key={invite.id} truckId={truckId} invite={invite} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function InviteForm({ truckId }: { truckId: string }) {
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function submit() {
    setError(null)
    setLink(null)
    startTransition(async () => {
      try {
        const invite = await createInviteAction(truckId, email)
        setLink(invite.url)
        setEmail('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <section>
      <h2 className="font-medium">Invite a manager</h2>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="flex-1 rounded border px-2 py-1 text-sm"
        />
        <button
          onClick={submit}
          disabled={isPending || !email.trim()}
          className="text-sm underline disabled:opacity-50"
        >
          Send invite
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {link && (
        <div className="mt-2 rounded border bg-gray-50 p-2 text-sm">
          <p className="text-gray-500">
            No email is sent — copy this link and share it yourself. It only works for {email || 'the invited email'}.
          </p>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="mt-1 w-full rounded border px-2 py-1 text-xs"
          />
        </div>
      )}
    </section>
  )
}

function ManagerRow({
  truckId,
  manager,
  isOwner,
  canOfferOwnership,
}: {
  truckId: string
  manager: TruckManagerView
  isOwner: boolean
  canOfferOwnership: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState<'remove' | 'offer' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function remove() {
    setError(null)
    startTransition(async () => {
      try {
        await removeManagerAction(truckId, manager.userId)
        setConfirming(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  function offerOwnership() {
    setError(null)
    startTransition(async () => {
      try {
        await initiateTransferAction(truckId, manager.userId)
        setConfirming(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <li className="flex items-center justify-between border-t pt-2 text-sm">
      <span>{manager.displayName ? `${manager.displayName} (${manager.email})` : manager.email}</span>
      {isOwner && confirming === null && (
        <span className="flex items-center gap-3">
          {canOfferOwnership && (
            <button onClick={() => setConfirming('offer')} disabled={isPending} className="underline disabled:opacity-50">
              Make owner
            </button>
          )}
          <button onClick={() => setConfirming('remove')} disabled={isPending} className="text-red-600 disabled:opacity-50">
            Remove
          </button>
        </span>
      )}
      {isOwner && confirming === 'remove' && (
        <span className="flex items-center gap-2">
          <span className="text-gray-500">Remove {manager.email}?</span>
          <button onClick={remove} disabled={isPending} className="underline disabled:opacity-50">
            Confirm
          </button>
          <button onClick={() => setConfirming(null)} disabled={isPending} className="text-gray-500">
            Cancel
          </button>
        </span>
      )}
      {isOwner && confirming === 'offer' && (
        <span className="flex items-center gap-2">
          <span className="text-gray-500">Make {manager.email} the owner? You'll become a manager.</span>
          <button onClick={offerOwnership} disabled={isPending} className="underline disabled:opacity-50">
            Confirm
          </button>
          <button onClick={() => setConfirming(null)} disabled={isPending} className="text-gray-500">
            Cancel
          </button>
        </span>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </li>
  )
}

/** Owner-facing banner shown above the managers list while a transfer offer is outstanding. */
function PendingTransferStatus({
  truckId,
  pendingOwner,
}: {
  truckId: string
  pendingOwner: TruckManagerView
}) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function cancel() {
    setError(null)
    startTransition(async () => {
      try {
        await cancelTransferAction(truckId)
        setConfirming(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div className="mt-2 rounded border bg-gray-50 p-2 text-sm">
      <div className="flex items-center justify-between">
        <span>Ownership transfer pending: {pendingOwner.email}</span>
        {!confirming && (
          <button onClick={() => setConfirming(true)} disabled={isPending} className="text-red-600 disabled:opacity-50">
            Cancel
          </button>
        )}
        {confirming && (
          <span className="flex items-center gap-2">
            <button onClick={cancel} disabled={isPending} className="underline disabled:opacity-50">
              Confirm cancel
            </button>
            <button onClick={() => setConfirming(false)} disabled={isPending} className="text-gray-500">
              Never mind
            </button>
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-red-600">{error}</p>}
    </div>
  )
}

/** Shown to the specific manager who's been offered ownership — never auto-fires, mirrors the invite-claim page's explicit accept step. */
function PendingTransferOffer({ truckId }: { truckId: string }) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function respond(action: 'accept' | 'decline') {
    setError(null)
    startTransition(async () => {
      try {
        await (action === 'accept' ? acceptTransferAction(truckId) : declineTransferAction(truckId))
        setConfirming(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <section className="rounded border bg-gray-50 p-3 text-sm">
      <p>You've been offered ownership of this truck.</p>
      {confirming === null && (
        <div className="mt-2 flex items-center gap-3">
          <button onClick={() => setConfirming('accept')} disabled={isPending} className="underline disabled:opacity-50">
            Accept
          </button>
          <button onClick={() => setConfirming('decline')} disabled={isPending} className="text-red-600 disabled:opacity-50">
            Decline
          </button>
        </div>
      )}
      {confirming === 'accept' && (
        <div className="mt-2 flex items-center gap-2 text-gray-500">
          <span>Accept ownership? You'll become the owner and the current owner will become a manager.</span>
          <button onClick={() => respond('accept')} disabled={isPending} className="underline disabled:opacity-50">
            Confirm
          </button>
          <button onClick={() => setConfirming(null)} disabled={isPending}>
            Never mind
          </button>
        </div>
      )}
      {confirming === 'decline' && (
        <div className="mt-2 flex items-center gap-2 text-gray-500">
          <span>Decline this offer?</span>
          <button onClick={() => respond('decline')} disabled={isPending} className="underline disabled:opacity-50">
            Confirm
          </button>
          <button onClick={() => setConfirming(null)} disabled={isPending}>
            Never mind
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-red-600">{error}</p>}
    </section>
  )
}

function InviteRow({ truckId, invite }: { truckId: string; invite: TruckInviteView }) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function copyLink() {
    const url = `${window.location.origin}/invite/${invite.token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function cancel() {
    setError(null)
    startTransition(async () => {
      try {
        await cancelInviteAction(truckId, invite.id)
        setConfirming(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <li className="border-t pt-2 text-sm">
      <div className="flex items-center justify-between">
        <span>
          {invite.invitedEmail}{' '}
          <span className="text-gray-500">
            (expires {new Date(invite.expiresAt).toLocaleDateString()})
          </span>
        </span>
        <span className="flex items-center gap-3">
          <button onClick={copyLink} className="underline">
            {copied ? 'Copied' : 'Copy link'}
          </button>
          {!confirming && (
            <button onClick={() => setConfirming(true)} disabled={isPending} className="text-red-600 disabled:opacity-50">
              Cancel
            </button>
          )}
        </span>
      </div>
      {confirming && (
        <div className="mt-1 flex items-center gap-2 text-gray-500">
          <span>Cancel this invite?</span>
          <button onClick={cancel} disabled={isPending} className="underline disabled:opacity-50">
            Confirm
          </button>
          <button onClick={() => setConfirming(false)} disabled={isPending}>
            Never mind
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-red-600">{error}</p>}
    </li>
  )
}
