import { describe, it, expect, vi, beforeEach } from 'vitest'

const refreshFeedView = vi.fn()
const createFunction = vi.fn((config, handler) => ({ config, handler }))
const openErasureBlockedEntry = vi.fn()
const removeAllPhotoLikesForUser = vi.fn()
const deactivateTrucks = vi.fn()
const eraseUserRow = vi.fn()
const findSoleOwnedTrucks = vi.fn()
const findUserByClerkId = vi.fn()
const sendEmail = vi.fn()
const getTruckNameAndSlug = vi.fn()
const getOptedInFavoriterEmails = vi.fn()
const activationEmailHtml = vi.fn((truck: { name: string }) => `<p>${truck.name}</p>`)
const getEventNotifyOptedInEmails = vi.fn()
const newEventEmailHtml = vi.fn(
  (truck: { name: string }, event: { title: string }) => `<p>${truck.name}: ${event.title}</p>`,
)
const getEventTitle = vi.fn()
const getOperatorEmails = vi.fn()
const verificationDecisionEmailHtml = vi.fn(
  (_truckId: string, truck: { name: string }, decision: string) => `<p>${truck.name}: ${decision}</p>`,
)

vi.mock('@/lib/feed', () => ({ refreshFeedView }))
vi.mock('@/lib/moderation-queue', () => ({ openErasureBlockedEntry }))
vi.mock('@/lib/review-photos', () => ({ removeAllPhotoLikesForUser }))
vi.mock('@/lib/user-erasure', () => ({
  deactivateTrucks,
  eraseUserRow,
  findSoleOwnedTrucks,
  findUserByClerkId,
}))
vi.mock('@/lib/email', () => ({ sendEmail }))
vi.mock('@/lib/events', () => ({ getEventTitle }))
vi.mock('@/lib/favorite-notifications', () => ({
  getTruckNameAndSlug,
  getOptedInFavoriterEmails,
  activationEmailHtml,
  getEventNotifyOptedInEmails,
  newEventEmailHtml,
}))
vi.mock('@/lib/verification-notifications', () => ({ getOperatorEmails, verificationDecisionEmailHtml }))
vi.mock('./client', () => ({ inngest: { createFunction } }))

const {
  refreshFeedHandler,
  refreshFeedFunction,
  eraseUserHandler,
  eraseUserFunction,
  notifyFavoritesOnActivationHandler,
  notifyFavoritesOnActivationFunction,
  notifyFavoritesOnNewEventHandler,
  notifyFavoritesOnNewEventFunction,
  notifyOperatorsOnVerificationDecisionHandler,
  notifyOperatorsOnVerificationDecisionFunction,
} = await import('./functions')

async function run<T>(id: string, fn: () => Promise<T>): Promise<T> {
  return fn()
}

describe('refreshFeedHandler', () => {
  beforeEach(() => refreshFeedView.mockReset())

  it('runs refreshFeedView inside a named step', async () => {
    refreshFeedView.mockResolvedValue(undefined)
    let stepId: string | null = null
    async function run<T>(id: string, fn: () => Promise<T>): Promise<T> {
      stepId = id
      return fn()
    }

    await refreshFeedHandler({ step: { run } })

    expect(stepId).toBe('refresh-feed-view')
    expect(refreshFeedView).toHaveBeenCalledTimes(1)
  })
})

describe('refreshFeedFunction', () => {
  it('registers with the expected id and a daily cron trigger', () => {
    expect(createFunction).toHaveBeenCalledWith(
      {
        id: 'refresh-feed',
        name: 'Refresh feed materialized view',
        triggers: [{ cron: '0 0 * * *' }],
      },
      refreshFeedHandler,
    )
  })

  it('is the value returned by inngest.createFunction', () => {
    expect(refreshFeedFunction).toEqual({
      config: {
        id: 'refresh-feed',
        name: 'Refresh feed materialized view',
        triggers: [{ cron: '0 0 * * *' }],
      },
      handler: refreshFeedHandler,
    })
  })
})

describe('eraseUserHandler', () => {
  beforeEach(() => {
    findUserByClerkId.mockReset()
    findSoleOwnedTrucks.mockReset()
    deactivateTrucks.mockReset()
    openErasureBlockedEntry.mockReset()
    removeAllPhotoLikesForUser.mockReset()
    eraseUserRow.mockReset()
  })

  it('no-ops when the user cannot be found (already erased, or the sync raced ahead)', async () => {
    findUserByClerkId.mockResolvedValue(null)

    await eraseUserHandler({ step: { run }, event: { data: { clerkId: 'clerk_1' } } })

    expect(findSoleOwnedTrucks).not.toHaveBeenCalled()
    expect(eraseUserRow).not.toHaveBeenCalled()
  })

  it('holds erasure when the user is a sole owner — deactivates trucks and opens a queue entry, does not erase', async () => {
    const user = { id: 'u1', email: 'ada@example.com', displayName: 'Ada' }
    findUserByClerkId.mockResolvedValue(user)
    findSoleOwnedTrucks.mockResolvedValue([{ id: 't1', name: 'Taco Kings', slug: 'taco-kings' }])

    await eraseUserHandler({ step: { run }, event: { data: { clerkId: 'clerk_1' } } })

    expect(deactivateTrucks).toHaveBeenCalledWith(['t1'])
    expect(openErasureBlockedEntry).toHaveBeenCalledWith(
      user,
      [{ id: 't1', name: 'Taco Kings', slug: 'taco-kings' }],
      expect.stringContaining('sole owner'),
    )
    expect(removeAllPhotoLikesForUser).not.toHaveBeenCalled()
    expect(eraseUserRow).not.toHaveBeenCalled()
  })

  it('removes likes then erases when the user owns nothing', async () => {
    const user = { id: 'u1', email: 'ada@example.com', displayName: 'Ada' }
    findUserByClerkId.mockResolvedValue(user)
    findSoleOwnedTrucks.mockResolvedValue([])

    await eraseUserHandler({ step: { run }, event: { data: { clerkId: 'clerk_1' } } })

    expect(deactivateTrucks).not.toHaveBeenCalled()
    expect(openErasureBlockedEntry).not.toHaveBeenCalled()
    expect(removeAllPhotoLikesForUser).toHaveBeenCalledWith('u1')
    expect(eraseUserRow).toHaveBeenCalledWith(user)
  })
})

describe('eraseUserFunction', () => {
  it('registers with the expected id and an event trigger', () => {
    expect(createFunction).toHaveBeenCalledWith(
      { id: 'erase-user', name: 'Erase a deleted Clerk user', triggers: [{ event: 'app/user.deleted' }] },
      eraseUserHandler,
    )
  })

  it('is the value returned by inngest.createFunction', () => {
    expect(eraseUserFunction).toEqual({
      config: { id: 'erase-user', name: 'Erase a deleted Clerk user', triggers: [{ event: 'app/user.deleted' }] },
      handler: eraseUserHandler,
    })
  })
})

describe('notifyFavoritesOnActivationHandler', () => {
  beforeEach(() => {
    sendEmail.mockReset().mockResolvedValue(undefined)
    getTruckNameAndSlug.mockReset()
    getOptedInFavoriterEmails.mockReset()
  })

  it('no-ops when the truck no longer exists', async () => {
    getTruckNameAndSlug.mockResolvedValue(null)

    await notifyFavoritesOnActivationHandler({ step: { run }, event: { data: { truckId: 't1' } } })

    expect(getOptedInFavoriterEmails).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('no-ops when nobody has opted in', async () => {
    getTruckNameAndSlug.mockResolvedValue({ name: 'Taco Kings', slug: 'taco-kings' })
    getOptedInFavoriterEmails.mockResolvedValue([])

    await notifyFavoritesOnActivationHandler({ step: { run }, event: { data: { truckId: 't1' } } })

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('sends one email per opted-in favoriter', async () => {
    getTruckNameAndSlug.mockResolvedValue({ name: 'Taco Kings', slug: 'taco-kings' })
    getOptedInFavoriterEmails.mockResolvedValue(['a@example.com', 'b@example.com'])

    await notifyFavoritesOnActivationHandler({ step: { run }, event: { data: { truckId: 't1' } } })

    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'a@example.com',
      subject: 'Taco Kings is active now',
      html: expect.stringContaining('Taco Kings'),
    })
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'b@example.com',
      subject: 'Taco Kings is active now',
      html: expect.stringContaining('Taco Kings'),
    })
  })

  it('does not let one recipient failing stop the others from sending', async () => {
    getTruckNameAndSlug.mockResolvedValue({ name: 'Taco Kings', slug: 'taco-kings' })
    getOptedInFavoriterEmails.mockResolvedValue(['a@example.com', 'b@example.com'])
    sendEmail.mockImplementation(async ({ to }: { to: string }) => {
      if (to === 'a@example.com') throw new Error('bounced')
    })

    await expect(
      notifyFavoritesOnActivationHandler({ step: { run }, event: { data: { truckId: 't1' } } }),
    ).resolves.toBeUndefined()

    expect(sendEmail).toHaveBeenCalledTimes(2)
  })
})

describe('notifyFavoritesOnActivationFunction', () => {
  it('registers with the expected id and an event trigger', () => {
    expect(createFunction).toHaveBeenCalledWith(
      {
        id: 'notify-favorites-on-activation',
        name: 'Notify favoriters when a truck goes active',
        triggers: [{ event: 'app/truck.activated' }],
      },
      notifyFavoritesOnActivationHandler,
    )
  })
})

describe('notifyFavoritesOnNewEventHandler', () => {
  beforeEach(() => {
    sendEmail.mockReset().mockResolvedValue(undefined)
    getTruckNameAndSlug.mockReset()
    getEventTitle.mockReset()
    getEventNotifyOptedInEmails.mockReset()
  })

  const eventPayload = { step: { run }, event: { data: { truckId: 't1', eventId: 'e1' } } }

  it('no-ops when the truck no longer exists', async () => {
    getTruckNameAndSlug.mockResolvedValue(null)

    await notifyFavoritesOnNewEventHandler(eventPayload)

    expect(getEventTitle).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('no-ops when the event no longer exists', async () => {
    getTruckNameAndSlug.mockResolvedValue({ name: 'Taco Kings', slug: 'taco-kings' })
    getEventTitle.mockResolvedValue(null)

    await notifyFavoritesOnNewEventHandler(eventPayload)

    expect(getEventNotifyOptedInEmails).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('no-ops when nobody has opted in', async () => {
    getTruckNameAndSlug.mockResolvedValue({ name: 'Taco Kings', slug: 'taco-kings' })
    getEventTitle.mockResolvedValue({ title: 'Pop-Up' })
    getEventNotifyOptedInEmails.mockResolvedValue([])

    await notifyFavoritesOnNewEventHandler(eventPayload)

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('sends one email per opted-in favoriter', async () => {
    getTruckNameAndSlug.mockResolvedValue({ name: 'Taco Kings', slug: 'taco-kings' })
    getEventTitle.mockResolvedValue({ title: 'Pop-Up' })
    getEventNotifyOptedInEmails.mockResolvedValue(['a@example.com', 'b@example.com'])

    await notifyFavoritesOnNewEventHandler(eventPayload)

    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'a@example.com',
      subject: 'Taco Kings posted a new event: Pop-Up',
      html: expect.stringContaining('Pop-Up'),
    })
  })

  it('does not let one recipient failing stop the others from sending', async () => {
    getTruckNameAndSlug.mockResolvedValue({ name: 'Taco Kings', slug: 'taco-kings' })
    getEventTitle.mockResolvedValue({ title: 'Pop-Up' })
    getEventNotifyOptedInEmails.mockResolvedValue(['a@example.com', 'b@example.com'])
    sendEmail.mockImplementation(async ({ to }: { to: string }) => {
      if (to === 'a@example.com') throw new Error('bounced')
    })

    await expect(notifyFavoritesOnNewEventHandler(eventPayload)).resolves.toBeUndefined()
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })
})

describe('notifyFavoritesOnNewEventFunction', () => {
  it('registers with the expected id and an event trigger', () => {
    expect(createFunction).toHaveBeenCalledWith(
      {
        id: 'notify-favorites-on-new-event',
        name: 'Notify favoriters when a truck posts a new event',
        triggers: [{ event: 'app/truck.event-created' }],
      },
      notifyFavoritesOnNewEventHandler,
    )
  })
})

describe('notifyOperatorsOnVerificationDecisionHandler', () => {
  beforeEach(() => {
    sendEmail.mockReset().mockResolvedValue(undefined)
    getTruckNameAndSlug.mockReset()
    getOperatorEmails.mockReset()
    verificationDecisionEmailHtml.mockClear()
  })

  const eventPayload = {
    step: { run },
    event: { data: { truckId: 't1', decision: 'rejected' as const, note: 'Fake business' } },
  }

  it('no-ops when the truck no longer exists', async () => {
    getTruckNameAndSlug.mockResolvedValue(null)

    await notifyOperatorsOnVerificationDecisionHandler(eventPayload)

    expect(getOperatorEmails).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('no-ops when the truck has no operators', async () => {
    getTruckNameAndSlug.mockResolvedValue({ name: 'Taco Kings', slug: 'taco-kings' })
    getOperatorEmails.mockResolvedValue([])

    await notifyOperatorsOnVerificationDecisionHandler(eventPayload)

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('sends one email per operator, passing the truckId/decision/note through', async () => {
    getTruckNameAndSlug.mockResolvedValue({ name: 'Taco Kings', slug: 'taco-kings' })
    getOperatorEmails.mockResolvedValue(['owner@example.com', 'manager@example.com'])

    await notifyOperatorsOnVerificationDecisionHandler(eventPayload)

    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'owner@example.com',
      subject: 'Taco Kings — verification update',
      html: expect.stringContaining('Taco Kings'),
    })
    expect(verificationDecisionEmailHtml).toHaveBeenCalledWith(
      't1',
      { name: 'Taco Kings', slug: 'taco-kings' },
      'rejected',
      'Fake business',
    )
  })

  it('does not let one recipient failing stop the others from sending', async () => {
    getTruckNameAndSlug.mockResolvedValue({ name: 'Taco Kings', slug: 'taco-kings' })
    getOperatorEmails.mockResolvedValue(['owner@example.com', 'manager@example.com'])
    sendEmail.mockImplementation(async ({ to }: { to: string }) => {
      if (to === 'owner@example.com') throw new Error('bounced')
    })

    await expect(notifyOperatorsOnVerificationDecisionHandler(eventPayload)).resolves.toBeUndefined()
    expect(sendEmail).toHaveBeenCalledTimes(2)
  })
})

describe('notifyOperatorsOnVerificationDecisionFunction', () => {
  it('registers with the expected id and an event trigger', () => {
    expect(createFunction).toHaveBeenCalledWith(
      {
        id: 'notify-operators-on-verification-decision',
        name: "Notify operators when a truck's verification status changes",
        triggers: [{ event: 'app/truck.verification-decided' }],
      },
      notifyOperatorsOnVerificationDecisionHandler,
    )
  })
})
