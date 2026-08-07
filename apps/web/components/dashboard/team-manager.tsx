'use client'

import { useState, useTransition } from 'react'
import type { TruckInviteView, TruckManagerView } from '@chomp/types'
import {
  cancelInviteAction,
  createInviteAction,
  removeManagerAction,
} from '@/app/actions/invites'

export function TeamManager({
  truckId,
  isOwner,
  managers,
  invites,
}: {
  truckId: string
  isOwner: boolean
  managers: TruckManagerView[]
  invites: TruckInviteView[]
}) {
  const pendingInvites = invites.filter((invite) => invite.status === 'pending')

  return (
    <div className="space-y-8">
      {isOwner && <InviteForm truckId={truckId} />}

      <section>
        <h2 className="font-medium">Managers</h2>
        {managers.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No managers yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {managers.map((manager) => (
              <ManagerRow key={manager.userId} truckId={truckId} manager={manager} isOwner={isOwner} />
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
}: {
  truckId: string
  manager: TruckManagerView
  isOwner: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function remove() {
    setError(null)
    startTransition(async () => {
      try {
        await removeManagerAction(truckId, manager.userId)
        setConfirming(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <li className="flex items-center justify-between border-t pt-2 text-sm">
      <span>{manager.displayName ? `${manager.displayName} (${manager.email})` : manager.email}</span>
      {isOwner && !confirming && (
        <button onClick={() => setConfirming(true)} disabled={isPending} className="text-red-600 disabled:opacity-50">
          Remove
        </button>
      )}
      {isOwner && confirming && (
        <span className="flex items-center gap-2">
          <span className="text-gray-500">Remove {manager.email}?</span>
          <button onClick={remove} disabled={isPending} className="underline disabled:opacity-50">
            Confirm
          </button>
          <button onClick={() => setConfirming(false)} disabled={isPending} className="text-gray-500">
            Cancel
          </button>
        </span>
      )}
      {error && <p className="text-red-600">{error}</p>}
    </li>
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
