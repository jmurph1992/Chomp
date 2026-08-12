/**
 * Pure transforms for the in-app navigation history stack used to power
 * "smart back" on the truck detail page. Storage (sessionStorage) lives in
 * apps/web — this module only knows how to grow/read a plain string[] stack.
 */

/** Caps memory/storage use; a back-nav stack never needs more than this. */
export const MAX_NAV_HISTORY = 20

/**
 * Appends a pathname to the stack, deduping a consecutive repeat (e.g. a
 * re-render or refresh on the same page) and capping the stack length by
 * dropping the oldest entries.
 */
export function appendToNavHistory(stack: string[], pathname: string): string[] {
  if (stack.at(-1) === pathname) return stack

  const next = [...stack, pathname]
  return next.length > MAX_NAV_HISTORY ? next.slice(next.length - MAX_NAV_HISTORY) : next
}

/**
 * True once the stack holds more than the current page, i.e. there's
 * somewhere in-app to go back to.
 */
export function hasInAppHistory(stack: string[]): boolean {
  return stack.length > 1
}
