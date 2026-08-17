import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireOperator = vi.fn()
const checkRateLimit = vi.fn()
const createEvent = vi.fn()
const updateEvent = vi.fn()
const deleteEvent = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/operators', () => ({ requireOperator }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit, eventLimiter: 'event-limiter' }))
vi.mock('@/lib/events', () => ({ createEvent, updateEvent, deleteEvent }))
vi.mock('next/cache', () => ({ revalidatePath }))

const { createEventAction, updateEventAction, deleteEventAction } = await import('./events')

const NOT_AUTHORIZED = new Error('Not authorized to manage this truck')
const validInput = { title: 'Pop-Up', description: null, startsAt: null, endsAt: null, address: null }

beforeEach(() => {
  requireOperator.mockReset()
  checkRateLimit.mockReset()
  createEvent.mockReset()
  updateEvent.mockReset()
  deleteEvent.mockReset()
})

describe('createEventAction', () => {
  it('rejects an unauthorized caller before rate-limiting or writing', async () => {
    requireOperator.mockRejectedValue(NOT_AUTHORIZED)
    await expect(createEventAction('t1', 'slug', validInput)).rejects.toThrow('Not authorized')
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(createEvent).not.toHaveBeenCalled()
  })

  it('rate-limits by the caller before creating', async () => {
    requireOperator.mockResolvedValue({ user: { id: 'u1' }, role: 'owner' })
    checkRateLimit.mockRejectedValue(new Error("You're doing that too often — try again in a bit."))

    await expect(createEventAction('t1', 'slug', validInput)).rejects.toThrow('too often')
    expect(checkRateLimit).toHaveBeenCalledWith('event-limiter', 'u1')
    expect(createEvent).not.toHaveBeenCalled()
  })

  it('delegates for an authorized, unthrottled operator', async () => {
    requireOperator.mockResolvedValue({ user: { id: 'u1' }, role: 'owner' })
    checkRateLimit.mockResolvedValue(undefined)
    createEvent.mockResolvedValue({})

    await createEventAction('t1', 'slug', validInput)

    expect(createEvent).toHaveBeenCalledWith('t1', validInput)
  })
})

describe('updateEventAction', () => {
  it('rejects an unauthorized caller before writing', async () => {
    requireOperator.mockRejectedValue(NOT_AUTHORIZED)
    await expect(updateEventAction('t1', 'slug', 'e1', validInput)).rejects.toThrow('Not authorized')
    expect(updateEvent).not.toHaveBeenCalled()
  })
})

describe('deleteEventAction', () => {
  it('rejects an unauthorized caller before deleting', async () => {
    requireOperator.mockRejectedValue(NOT_AUTHORIZED)
    await expect(deleteEventAction('t1', 'slug', 'e1')).rejects.toThrow('Not authorized')
    expect(deleteEvent).not.toHaveBeenCalled()
  })
})
