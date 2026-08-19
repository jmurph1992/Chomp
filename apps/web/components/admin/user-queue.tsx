'use client'

import { useState, useTransition } from 'react'
import type { AdminUserView } from '@chomp/types'
import { deleteUserAction } from '@/app/actions/admin-users'

export function AdminUserQueue({ users }: { users: AdminUserView[] }) {
  return (
    <ul className="mt-6 space-y-4">
      {users.map((user) => (
        <UserRow key={user.id} user={user} />
      ))}
    </ul>
  )
}

function UserRow({ user }: { user: AdminUserView }) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [typedEmail, setTypedEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [blockedNotice, setBlockedNotice] = useState(false)

  const canDelete = typedEmail.trim().toLowerCase() === user.email.toLowerCase()

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteUserAction(user.id, typedEmail)
        if (result.blocked) {
          setBlockedNotice(true)
          setConfirming(false)
          setTypedEmail('')
        } else {
          setConfirming(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <li className="border-t pt-4">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-medium">{user.displayName ?? 'No name'}</span>{' '}
          <span className="text-sm text-gray-500">
            {user.email} · {user.role}
            {user.ownedTruckCount > 0 && ` · owns ${user.ownedTruckCount} truck(s)`}
          </span>
        </div>
        <span className="text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</span>
      </div>

      {blockedNotice && (
        <p className="mt-2 text-sm text-amber-700">
          Blocked — this user owns a truck with no one else to hand it to. Their account was banned
          and a moderation entry was opened. See the Moderation tab.
        </p>
      )}

      {user.role === 'admin' ? (
        <p className="mt-2 text-sm text-gray-400">Admin accounts can&apos;t be deleted through this tool.</p>
      ) : confirming ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            placeholder={`Type ${user.email} to confirm`}
            className="flex-1 rounded border px-2 py-1 text-sm"
          />
          <button
            onClick={handleDelete}
            disabled={!canDelete || isPending}
            className="text-sm text-red-600 underline disabled:opacity-50"
          >
            Confirm delete
          </button>
          <button
            onClick={() => {
              setConfirming(false)
              setTypedEmail('')
              setError(null)
            }}
            disabled={isPending}
            className="text-sm text-gray-500"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="mt-2 text-sm text-red-600">
          Delete account
        </button>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </li>
  )
}
