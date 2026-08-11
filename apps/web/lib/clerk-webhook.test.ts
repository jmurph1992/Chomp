import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WebhookEvent } from '@clerk/nextjs/webhooks'

const userCreate = vi.fn()
const userUpdate = vi.fn()
const inngestSend = vi.fn()

vi.mock('@chomp/db', () => ({
  db: {
    user: {
      create: userCreate,
      update: userUpdate,
    },
  },
}))
vi.mock('@/inngest/client', () => ({ inngest: { send: inngestSend } }))

const { handleClerkWebhookEvent } = await import('./clerk-webhook')

function userEvent(type: 'user.created' | 'user.updated', overrides = {}) {
  return {
    type,
    object: 'event',
    data: {
      id: 'user_123',
      first_name: 'Ada',
      last_name: 'Lovelace',
      username: 'ada',
      image_url: 'https://img.clerk.com/ada.png',
      primary_email_address_id: 'idn_primary',
      email_addresses: [
        { id: 'idn_secondary', email_address: 'secondary@example.com' },
        { id: 'idn_primary', email_address: 'ada@example.com' },
      ],
      ...overrides,
    },
  } as unknown as WebhookEvent
}

describe('handleClerkWebhookEvent', () => {
  beforeEach(() => {
    userCreate.mockReset()
    userUpdate.mockReset()
    inngestSend.mockReset()
  })

  it('creates a user with the primary email, default role, and display name on user.created', async () => {
    await handleClerkWebhookEvent(userEvent('user.created'))

    expect(userCreate).toHaveBeenCalledWith({
      data: {
        clerkId: 'user_123',
        email: 'ada@example.com',
        displayName: 'Ada Lovelace',
        avatarUrl: 'https://img.clerk.com/ada.png',
      },
    })
  })

  it('falls back to username when no name is set', async () => {
    await handleClerkWebhookEvent(
      userEvent('user.created', { first_name: null, last_name: null }),
    )

    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayName: 'ada' }) }),
    )
  })

  it('throws when the user has no email address', async () => {
    await expect(
      handleClerkWebhookEvent(userEvent('user.created', { email_addresses: [] })),
    ).rejects.toThrow('has no email address')
    expect(userCreate).not.toHaveBeenCalled()
  })

  it('updates the matching user on user.updated', async () => {
    await handleClerkWebhookEvent(userEvent('user.updated'))

    expect(userUpdate).toHaveBeenCalledWith({
      where: { clerkId: 'user_123' },
      data: {
        email: 'ada@example.com',
        displayName: 'Ada Lovelace',
        avatarUrl: 'https://img.clerk.com/ada.png',
      },
    })
  })

  it('does not touch the database directly on user.deleted — hands off to the erasure Inngest job instead', async () => {
    const evt = {
      type: 'user.deleted',
      object: 'event',
      data: { id: 'user_123', deleted: true },
    } as unknown as WebhookEvent

    await expect(handleClerkWebhookEvent(evt)).resolves.toBeUndefined()
    expect(userCreate).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
    expect(inngestSend).toHaveBeenCalledWith({ name: 'app/user.deleted', data: { clerkId: 'user_123' } })
  })

  it('skips sending the erasure event when the deleted payload has no id', async () => {
    const evt = {
      type: 'user.deleted',
      object: 'event',
      data: { deleted: true },
    } as unknown as WebhookEvent

    await expect(handleClerkWebhookEvent(evt)).resolves.toBeUndefined()
    expect(inngestSend).not.toHaveBeenCalled()
  })

  it('ignores non-user event types', async () => {
    const evt = {
      type: 'session.created',
      object: 'event',
      data: { id: 'sess_123' },
    } as unknown as WebhookEvent

    await expect(handleClerkWebhookEvent(evt)).resolves.toBeUndefined()
    expect(userCreate).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
  })
})
