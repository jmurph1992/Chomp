import { timeAgo, isLocationActive } from '@chomp/utils'

type Props = {
  reportedAt: string | null
  expiresAt: string | null
}

/**
 * Shared between the customer-facing truck page and the operator's own
 * dashboard form so the two can't drift out of sync on what "active" looks
 * like. Renders nothing if there's no current location row at all.
 */
export function LocationStatus({ reportedAt, expiresAt }: Props) {
  if (!reportedAt) return null

  if (isLocationActive(expiresAt)) {
    return (
      <p className="text-sm font-medium text-green-700">
        Active now
        {expiresAt && ` — until ${new Date(expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
      </p>
    )
  }

  return <p className="text-sm text-gray-500">Last active {timeAgo(reportedAt)}</p>
}
