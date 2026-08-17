import type { OpenNowStatus } from '@chomp/utils'

function formatTime(iso: string): string {
  // Same "read the literal wall-clock value, not the server's local offset"
  // reasoning as formatTime in app/trucks/[slug]/page.tsx — see its comment.
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

/**
 * Mirrors LocationStatus's shape (green "active" badge vs. a muted line) —
 * deliberately not rendered at all when status is 'unknown' (no timezone
 * set on the truck), so a truck without one falls back to exactly the
 * existing plain-text schedule display, no regression.
 */
export function OpenNowStatusBadge({ status }: { status: OpenNowStatus }) {
  if (status.status === 'unknown') return null

  if (status.status === 'open') {
    return (
      <p className="mt-4 text-sm font-medium text-green-700">
        Open now — until {formatTime(status.closesAt)}
      </p>
    )
  }

  return <p className="mt-4 text-sm font-medium text-gray-500">Closed</p>
}
