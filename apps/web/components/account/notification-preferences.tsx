'use client'

import { useState, useTransition } from 'react'
import { updateNotificationPreferenceAction } from '@/app/actions/account'

type Props = {
  initialNotifyFavoriteActive: boolean
}

/** Opt-in, off by default — favoriting a truck alone never enables this. */
export function NotificationPreferences({ initialNotifyFavoriteActive }: Props) {
  const [notifyFavoriteActive, setNotifyFavoriteActive] = useState(initialNotifyFavoriteActive)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function toggle() {
    const next = !notifyFavoriteActive
    setNotifyFavoriteActive(next) // optimistic — matches ListFavoriteButton's pattern
    setError(null)
    startTransition(async () => {
      try {
        await updateNotificationPreferenceAction(next)
      } catch (err) {
        setNotifyFavoriteActive(!next)
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Notifications</h2>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={notifyFavoriteActive} onChange={toggle} />
        Email me when a truck I've favorited goes active nearby
      </label>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </section>
  )
}
