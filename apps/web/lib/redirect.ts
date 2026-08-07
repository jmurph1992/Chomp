/**
 * Only allows same-origin relative paths ("/invite/abc") — rejects absolute
 * URLs and protocol-relative ones ("//evil.com") that would otherwise let a
 * crafted `redirect_url` query param bounce a signed-in user off-site after
 * auth. Used to sanitize Clerk's post-auth redirect target. Returns null
 * (not undefined) for "no redirect" — Clerk's fallbackRedirectUrl prop is
 * typed `string | null`, and exactOptionalPropertyTypes rejects passing an
 * explicit `undefined` to an optional prop.
 */
export function safeRedirectPath(path: string | undefined): string | null {
  if (!path) return null
  if (!path.startsWith('/') || path.startsWith('//')) return null
  return path
}
