/**
 * Shared utility functions used across web and (future) mobile apps.
 * Keep this package dependency-free where possible.
 */

export * from './nav-links'
export * from './nav-history'
export * from './dashboard-tabs'
export * from './location-freshness'
export * from './truck-list-filters'

// ─── Slugs ────────────────────────────────────────────────────────────────────

/**
 * Converts a truck name to a URL-safe slug.
 * e.g. "Taco King's!" → "taco-kings"
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Formats a price in cents as a USD currency string.
 * e.g. 1250 → "$12.50"
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

/**
 * Formats a dollar amount (not cents) as a USD currency string.
 * e.g. 12.5 → "$12.50". Menu item prices are stored as whole dollars
 * (Decimal(8,2)), unlike formatPrice's cents — don't mix these up.
 */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

const METERS_PER_MILE = 1609.344

/**
 * Formats a PostGIS ST_Distance result (meters) as a miles string.
 * e.g. 804.67 → "0.5 mi". One decimal place — this app's radius/distance
 * values are all in miles-scale (10-50 mile search radius), not precise
 * enough to warrant more.
 */
export function formatDistanceMiles(meters: number): string {
  return `${(meters / METERS_PER_MILE).toFixed(1)} mi`
}

/**
 * Returns a human-readable relative time string.
 * e.g. "2 hours ago", "3 days ago"
 */
export function timeAgo(date: Date | string): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const diff = (new Date(date).getTime() - Date.now()) / 1000

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ]

  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) {
      return rtf.format(Math.round(diff / seconds), unit)
    }
  }

  return 'just now'
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Returns true if a rating value is valid (integer 1–5). */
export function isValidRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
}
