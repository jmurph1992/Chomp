import { sendEmail } from '@/lib/email'
import { getEventTitle } from '@/lib/events'
import {
  activationEmailHtml,
  getEventNotifyOptedInEmails,
  getOptedInFavoriterEmails,
  getTruckNameAndSlug,
  newEventEmailHtml,
} from '@/lib/favorite-notifications'
import { refreshFeedView } from '@/lib/feed'
import { openErasureBlockedEntry } from '@/lib/moderation-queue'
import { removeAllPhotoLikesForUser } from '@/lib/review-photos'
import { deactivateTrucks, eraseUserRow, findSoleOwnedTrucks, findUserByClerkId } from '@/lib/user-erasure'
import { getOperatorEmails, verificationDecisionEmailHtml } from '@/lib/verification-notifications'
import { inngest } from './client'
import type { VerificationStatusValue } from '@chomp/types'

type StepLike = { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> }

/**
 * Exported separately from refreshFeedFunction so it can be unit-tested
 * directly with a stub `step`, without needing Inngest's own test runtime.
 */
export async function refreshFeedHandler({ step }: { step: StepLike }): Promise<void> {
  await step.run('refresh-feed-view', () => refreshFeedView())
}

/** Refreshes the feed materialized view once a day — the whole refresh story now that the old CRON_SECRET route is gone. */
export const refreshFeedFunction = inngest.createFunction(
  {
    id: 'refresh-feed',
    name: 'Refresh feed materialized view',
    triggers: [{ cron: '0 0 * * *' }],
  },
  refreshFeedHandler,
)

type ErasureEvent = { data: { clerkId: string } }

/**
 * Exported separately for the same testability reason as refreshFeedHandler.
 * Fully idempotent — safe to run twice for the same clerkId, since a retried
 * or duplicate event (see lib/moderation-queue.ts#resolveModerationEntry,
 * which always sends one directly) just re-runs these checks against
 * whatever state remains. See lib/user-erasure.ts for what each step does
 * and why the ordering matters (likes must be removed with their counter
 * decrements *before* db.user.delete(), not left to a raw FK cascade).
 */
export async function eraseUserHandler({ step, event }: { step: StepLike; event: ErasureEvent }): Promise<void> {
  const user = await step.run('load-user', () => findUserByClerkId(event.data.clerkId))
  if (!user) return // already erased, or the webhook raced ahead of the initial user.created sync

  const blockingTrucks = await step.run('check-sole-ownership', () => findSoleOwnedTrucks(user.id))
  if (blockingTrucks.length > 0) {
    await step.run('deactivate-blocking-trucks', () => deactivateTrucks(blockingTrucks.map((t) => t.id)))
    await step.run('open-moderation-entry', () =>
      openErasureBlockedEntry(user, blockingTrucks, 'Erasure held: sole owner of at least one truck'),
    )
    return
  }

  await step.run('remove-photo-likes', () => removeAllPhotoLikesForUser(user.id))
  await step.run('delete-user', () => eraseUserRow(user))
}

/** First event-triggered function in this codebase (refreshFeedFunction above is cron-only). Fired from lib/clerk-webhook.ts's user.deleted case and from a resolved moderation-queue entry. */
export const eraseUserFunction = inngest.createFunction(
  { id: 'erase-user', name: 'Erase a deleted Clerk user', triggers: [{ event: 'app/user.deleted' }] },
  eraseUserHandler,
)

type TruckActivatedEvent = { data: { truckId: string } }

/**
 * Fired from lib/locations.ts#postLocation only on a real off->on
 * transition — never on a same-window re-post or extendLocation. Recipients
 * are resolved fresh here, not carried on the event, so a favorite/opt-out
 * change between the event firing and this running is naturally respected.
 */
export async function notifyFavoritesOnActivationHandler({
  step,
  event,
}: {
  step: StepLike
  event: TruckActivatedEvent
}): Promise<void> {
  const truck = await step.run('load-truck', () => getTruckNameAndSlug(event.data.truckId))
  if (!truck) return // deleted between activation and this running

  const recipients = await step.run('load-opted-in-favoriters', () =>
    getOptedInFavoriterEmails(event.data.truckId),
  )
  if (recipients.length === 0) return

  // allSettled, not all — one recipient's failed send shouldn't fail the
  // whole run and trigger an Inngest retry that re-emails everyone else.
  await step.run('send-emails', () =>
    Promise.allSettled(
      recipients.map((email) =>
        sendEmail({ to: email, subject: `${truck.name} is active now`, html: activationEmailHtml(truck) }),
      ),
    ),
  )
}

export const notifyFavoritesOnActivationFunction = inngest.createFunction(
  {
    id: 'notify-favorites-on-activation',
    name: 'Notify favoriters when a truck goes active',
    triggers: [{ event: 'app/truck.activated' }],
  },
  notifyFavoritesOnActivationHandler,
)

type TruckEventCreatedEvent = { data: { truckId: string; eventId: string } }

/**
 * Fired from lib/events.ts#createEvent's action wrapper after a successful
 * create. Same structure as notifyFavoritesOnActivationHandler, but opted
 * into per truck (TruckFavorite.notifyNewEvents) rather than the User-level
 * notifyFavoriteActive flag — see docs/features/events.md.
 */
export async function notifyFavoritesOnNewEventHandler({
  step,
  event,
}: {
  step: StepLike
  event: TruckEventCreatedEvent
}): Promise<void> {
  const truck = await step.run('load-truck', () => getTruckNameAndSlug(event.data.truckId))
  if (!truck) return // deleted between creation and this running

  const truckEvent = await step.run('load-event', () => getEventTitle(event.data.eventId))
  if (!truckEvent) return // deleted between creation and this running

  const recipients = await step.run('load-opted-in-favoriters', () =>
    getEventNotifyOptedInEmails(event.data.truckId),
  )
  if (recipients.length === 0) return

  await step.run('send-emails', () =>
    Promise.allSettled(
      recipients.map((email) =>
        sendEmail({
          to: email,
          subject: `${truck.name} posted a new event: ${truckEvent.title}`,
          html: newEventEmailHtml(truck, truckEvent),
        }),
      ),
    ),
  )
}

export const notifyFavoritesOnNewEventFunction = inngest.createFunction(
  {
    id: 'notify-favorites-on-new-event',
    name: 'Notify favoriters when a truck posts a new event',
    triggers: [{ event: 'app/truck.event-created' }],
  },
  notifyFavoritesOnNewEventHandler,
)

type TruckVerificationDecidedEvent = {
  data: { truckId: string; decision: VerificationStatusValue; note: string | null }
}

/**
 * Fired from lib/trucks.ts#verifyTruck/rejectTruck/holdTruck after every
 * call — unlike the activation/new-event handlers above, there's no
 * dedup/transition check: each call is a deliberate, low-frequency admin
 * decision with its own (possibly updated) reason, not a high-frequency
 * automatic trigger where re-notifying would be spammy. Always-on, no
 * opt-in preference — see lib/verification-notifications.ts.
 */
export async function notifyOperatorsOnVerificationDecisionHandler({
  step,
  event,
}: {
  step: StepLike
  event: TruckVerificationDecidedEvent
}): Promise<void> {
  const truck = await step.run('load-truck', () => getTruckNameAndSlug(event.data.truckId))
  if (!truck) return // deleted between the decision and this running

  const recipients = await step.run('load-operator-emails', () => getOperatorEmails(event.data.truckId))
  if (recipients.length === 0) return

  await step.run('send-emails', () =>
    Promise.allSettled(
      recipients.map((email) =>
        sendEmail({
          to: email,
          subject: `${truck.name} — verification update`,
          html: verificationDecisionEmailHtml(event.data.truckId, truck, event.data.decision, event.data.note),
        }),
      ),
    ),
  )
}

export const notifyOperatorsOnVerificationDecisionFunction = inngest.createFunction(
  {
    id: 'notify-operators-on-verification-decision',
    name: "Notify operators when a truck's verification status changes",
    triggers: [{ event: 'app/truck.verification-decided' }],
  },
  notifyOperatorsOnVerificationDecisionHandler,
)
