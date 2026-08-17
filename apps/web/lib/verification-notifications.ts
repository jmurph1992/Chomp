import { db } from '@chomp/db'
import type { VerificationStatusValue } from '@chomp/types'
import { appUrl } from './site-url'
import type { ActivatedTruck } from './favorite-notifications'

/**
 * Every operator on the truck — owner and managers alike, unlike
 * lib/invites.ts#listManagers, which deliberately excludes the owner for
 * its own (team-page-display) purpose. A verification decision affects
 * whoever's actually running the truck day to day, not just whoever owns
 * it — same "manager parity" reasoning requireOperator already applies
 * everywhere else in the dashboard.
 */
export async function getOperatorEmails(truckId: string): Promise<string[]> {
  const operators = await db.truckOperator.findMany({
    where: { truckId },
    include: { user: { select: { email: true } } },
  })
  return operators.map((op) => op.user.email)
}

/**
 * One email per recipient, never cc/bcc — same reasoning
 * favorite-notifications.ts's activationEmailHtml already documents.
 * verified links to the public page (the "you're live" moment);
 * rejected/onHold link to the dashboard instead — the public page 404s
 * for a non-verified truck (getTruckBySlug's verificationStatus gate), so
 * linking there would be a dead link.
 */
export function verificationDecisionEmailHtml(
  truckId: string,
  truck: ActivatedTruck,
  decision: VerificationStatusValue,
  note: string | null,
): string {
  if (decision === 'verified') {
    return `
      <p>${truck.name} has been verified and is now live on Chomp —
      <a href="${appUrl()}/trucks/${truck.slug}">see your public page</a>.</p>
    `
  }

  const outcome = decision === 'rejected' ? 'was not approved' : 'has been put on hold'
  return `
    <p>${truck.name} ${outcome}.</p>
    ${note ? `<p>Reason: ${note}</p>` : ''}
    <p><a href="${appUrl()}/dashboard/${truckId}">Go to your dashboard</a> for details.</p>
  `
}
