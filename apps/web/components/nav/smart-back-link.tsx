'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { hasInAppHistory } from '@chomp/utils'
import { readNavHistory } from '@/lib/nav-history-storage'

type Props = {
  /** Where to send the user when there's no in-app page to go back to. */
  fallbackHref: string
  label?: string
}

/**
 * Renders the fallback link on first render so SSR and the initial client
 * render match exactly (no hydration mismatch) — only after mount, once
 * sessionStorage can be read, does it switch to a real router.back() if
 * there's somewhere in-app to go back to.
 */
export function SmartBackLink({ fallbackHref, label = 'Back' }: Props) {
  const router = useRouter()
  const [canGoBack, setCanGoBack] = useState(false)

  useEffect(() => {
    setCanGoBack(hasInAppHistory(readNavHistory()))
  }, [])

  if (canGoBack) {
    return (
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {label}
      </button>
    )
  }

  return (
    <Link href={fallbackHref} className="text-sm text-muted-foreground hover:text-foreground">
      ← {label}
    </Link>
  )
}
