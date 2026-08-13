/**
 * "Active now" freshness logic for an operator's posted truck location.
 * Pure/framework-agnostic so it can be reused by a future native client.
 * Independent of `TruckSchedule` (weekly posted hours) — this is about
 * whether the operator's self-declared presence window has lapsed, not
 * whether the truck is "open."
 */

export type DurationPresetId = '1h' | '2h' | '3h' | '4h' | '6h' | 'allDay'

export type DurationPreset = {
  id: DurationPresetId
  label: string
  /** Fixed minutes from now, or null for 'allDay' (resolved via endOfLocalDay instead). */
  minutes: number | null
}

export const DURATION_PRESETS: readonly DurationPreset[] = [
  { id: '1h', label: '1 hour', minutes: 60 },
  { id: '2h', label: '2 hours', minutes: 120 },
  { id: '3h', label: '3 hours', minutes: 180 },
  { id: '4h', label: '4 hours', minutes: 240 },
  { id: '6h', label: '6 hours', minutes: 360 },
  { id: 'allDay', label: 'All day', minutes: null },
]

/** 23:59:59.999 on `now`'s local calendar day. */
export function endOfLocalDay(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
}

/** Resolves a preset to an absolute expiry instant. */
export function expiresAtForPreset(presetId: DurationPresetId, now: Date = new Date()): Date {
  if (presetId === 'allDay') return endOfLocalDay(now)

  const preset = DURATION_PRESETS.find((p) => p.id === presetId)
  if (!preset || preset.minutes === null) {
    throw new Error(`Unknown duration preset: ${presetId}`)
  }
  return new Date(now.getTime() + preset.minutes * 60_000)
}

/**
 * Trust-boundary cap on how far out `expiresAt` may be set, independent of
 * the UI's own preset list — the real server-side abuse guard. 48h (not
 * 24h) gives headroom above the legitimate worst case ("All day" posted at
 * 12:01am → ~24h) so clock skew near midnight can't spuriously reject a
 * real post, while still blocking anything resembling "post once, stay
 * active for a week."
 */
export const MAX_LOCATION_DURATION_HOURS = 48

/** Rejects an unparseable, non-future, or more-than-48h-out `expiresAt`. */
export function isValidExpiresAt(expiresAt: string, now: Date = new Date()): boolean {
  const parsed = new Date(expiresAt)
  if (Number.isNaN(parsed.getTime())) return false

  const diffMs = parsed.getTime() - now.getTime()
  if (diffMs <= 0) return false

  return diffMs <= MAX_LOCATION_DURATION_HOURS * 60 * 60 * 1000
}

/**
 * `expiresAt === null` means "does not expire" (only possible for legacy
 * pre-feature rows). Comparison is exclusive — a location expiring exactly
 * now is NOT active, matching the read-time SQL's `expires_at > now()`.
 */
export function isLocationActive(expiresAt: string | null, now: Date = new Date()): boolean {
  if (expiresAt === null) return true
  return new Date(expiresAt).getTime() > now.getTime()
}
