import type { WebhookEvent } from '@clerk/nextjs/webhooks'
import { db } from '@chomp/db'

/**
 * Handles a verified Clerk webhook event by syncing it into the `users` table.
 * Only `user.*` events are relevant here — everything else is acknowledged and ignored.
 */
export async function handleClerkWebhookEvent(evt: WebhookEvent): Promise<void> {
  switch (evt.type) {
    case 'user.created':
      await db.user.create({
        data: {
          clerkId: evt.data.id,
          email: getPrimaryEmail(evt.data),
          // Role always starts as customer — upgrading to operator is a
          // separate, not-yet-built flow. Never trust a role from the webhook payload.
          displayName: getDisplayName(evt.data),
          avatarUrl: evt.data.image_url || null,
        },
      })
      break

    case 'user.updated':
      await db.user.update({
        where: { clerkId: evt.data.id },
        data: {
          email: getPrimaryEmail(evt.data),
          displayName: getDisplayName(evt.data),
          avatarUrl: evt.data.image_url || null,
        },
      })
      break

    case 'user.deleted':
      // Known gap: we don't delete or soft-delete the DB row here because a user
      // can own trucks/reviews and the schema has no cascade or soft-delete field
      // yet. Tracked in /go-live-requirements — for now we just log so the event
      // isn't silently swallowed.
      console.warn(`Clerk user.deleted received for ${evt.data.id ?? 'unknown'} — no-op`)
      break

    default:
      // Not a user event (session, organization, etc.) — nothing to sync.
      break
  }
}

type ClerkUserPayload = {
  id: string
  first_name: string | null
  last_name: string | null
  username: string | null
  image_url: string
  primary_email_address_id: string | null
  email_addresses: { id: string; email_address: string }[]
}

function getPrimaryEmail(user: ClerkUserPayload): string {
  const primary = user.email_addresses.find((e) => e.id === user.primary_email_address_id)
  const email = primary?.email_address ?? user.email_addresses[0]?.email_address
  if (!email) {
    throw new Error(`Clerk user ${user.id} has no email address`)
  }
  return email
}

function getDisplayName(user: ClerkUserPayload): string | null {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return name || user.username || null
}
