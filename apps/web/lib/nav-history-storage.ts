/**
 * Thin sessionStorage wrapper around the pure stack transforms in
 * @chomp/utils. Tab-scoped by design: a fresh tab (direct link, shared URL)
 * starts with an empty stack, which is exactly what SmartBackLink needs to
 * correctly fall back instead of calling router.back() into nothing.
 */

const KEY = 'chomp:nav-history'

export function readNavHistory(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.sessionStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function writeNavHistory(stack: string[]): void {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(stack))
  } catch {
    // sessionStorage unavailable (private browsing, quota) — smart back-nav
    // degrades to always falling back, which is a safe default.
  }
}
