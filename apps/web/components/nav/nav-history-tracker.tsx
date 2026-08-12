'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { appendToNavHistory } from '@chomp/utils'
import { readNavHistory, writeNavHistory } from '@/lib/nav-history-storage'

/**
 * Renders nothing. Mounted once at the root so every page visited — however
 * the user got there — grows the in-app path stack that SmartBackLink reads
 * to decide whether "back" has somewhere in-app to go.
 */
export function NavHistoryTracker() {
  const pathname = usePathname()

  useEffect(() => {
    writeNavHistory(appendToNavHistory(readNavHistory(), pathname))
  }, [pathname])

  return null
}
