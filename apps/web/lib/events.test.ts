import { describe, it, expect, vi, beforeEach } from 'vitest'

const findMany = vi.fn()
const findUnique = vi.fn()
const create = vi.fn()
const updateMany = vi.fn()
const deleteMany = vi.fn()
const queryRaw = vi.fn()
const executeRaw = vi.fn()
const geocodeAddress = vi.fn()
const inngestSend = vi.fn()

vi.mock('@chomp/db', () => ({
  db: {
    truckEvent: { findMany, findUnique, create, updateMany, deleteMany },
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
  },
}))
vi.mock('./geocoding', () => ({ geocodeAddress }))
vi.mock('@/inngest/client', () => ({ inngest: { send: inngestSend } }))

const {
  getEventTitle,
  getEventsForEdit,
  getUpcomingEventsForTruck,
  getUpcomingEventsForFeed,
  createEvent,
  updateEvent,
  deleteEvent,
} = await import('./events')

const validInput = {
  title: 'Weekend Pop-Up',
  description: null,
  startsAt: null,
  endsAt: null,
  address: null,
}

beforeEach(() => {
  findMany.mockReset()
  findUnique.mockReset()
  create.mockReset()
  updateMany.mockReset()
  deleteMany.mockReset()
  queryRaw.mockReset()
  executeRaw.mockReset()
  geocodeAddress.mockReset()
  inngestSend.mockReset()
})

describe('getEventTitle', () => {
  it('returns null when the event no longer exists', async () => {
    findUnique.mockResolvedValue(null)
    expect(await getEventTitle('e1')).toBeNull()
  })

  it('returns the title', async () => {
    findUnique.mockResolvedValue({ title: 'Pop-Up' })
    expect(await getEventTitle('e1')).toEqual({ title: 'Pop-Up' })
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'e1' }, select: { title: true } })
  })
})

describe('getEventsForEdit', () => {
  it('scopes by truckId and orders by startsAt then createdAt', async () => {
    findMany.mockResolvedValue([])
    await getEventsForEdit('t1')

    expect(findMany).toHaveBeenCalledWith({
      where: { truckId: 't1' },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    })
  })

  it('maps dates to ISO strings and null dates through', async () => {
    findMany.mockResolvedValue([
      {
        id: 'e1',
        title: 'Pop-Up',
        description: null,
        startsAt: new Date('2026-09-01T00:00:00Z'),
        endsAt: null,
        address: null,
      },
    ])
    const result = await getEventsForEdit('t1')
    expect(result[0]).toMatchObject({ startsAt: '2026-09-01T00:00:00.000Z', endsAt: null })
  })
})

describe('getUpcomingEventsForTruck', () => {
  it('maps raw rows including coordinates', async () => {
    queryRaw.mockResolvedValue([
      {
        id: 'e1',
        title: 'Pop-Up',
        description: null,
        startsAt: new Date('2026-09-01T00:00:00Z'),
        endsAt: null,
        address: '123 Main St',
        lat: 30.27,
        lng: -97.74,
      },
    ])
    const result = await getUpcomingEventsForTruck('t1')
    expect(result).toEqual([
      {
        id: 'e1',
        title: 'Pop-Up',
        description: null,
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: null,
        address: '123 Main St',
        lat: 30.27,
        lng: -97.74,
      },
    ])
  })
})

describe('getUpcomingEventsForFeed', () => {
  it('maps raw rows including truck attribution', async () => {
    queryRaw.mockResolvedValue([
      {
        id: 'e1',
        title: 'Pop-Up',
        description: null,
        startsAt: null,
        endsAt: null,
        address: null,
        lat: null,
        lng: null,
        truckSlug: 'taco-kings',
        truckName: 'Taco Kings',
      },
    ])
    const result = await getUpcomingEventsForFeed(10)
    expect(result[0]).toMatchObject({ truckSlug: 'taco-kings', truckName: 'Taco Kings' })
  })
})

describe('createEvent', () => {
  it('rejects an empty title without creating', async () => {
    await expect(createEvent('t1', { ...validInput, title: '  ' })).rejects.toThrow('Title is required')
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects endsAt before startsAt', async () => {
    await expect(
      createEvent('t1', { ...validInput, startsAt: '2026-09-02T00:00:00Z', endsAt: '2026-09-01T00:00:00Z' }),
    ).rejects.toThrow('End time must be after start time')
    expect(create).not.toHaveBeenCalled()
  })

  it('creates without geocoding when no address is given', async () => {
    create.mockResolvedValue({ id: 'e1' })
    await createEvent('t1', validInput)

    expect(create).toHaveBeenCalledWith({
      data: {
        truckId: 't1',
        title: 'Weekend Pop-Up',
        description: null,
        startsAt: null,
        endsAt: null,
        address: null,
      },
    })
    expect(geocodeAddress).not.toHaveBeenCalled()
    expect(executeRaw).not.toHaveBeenCalled()
  })

  it('fires app/truck.event-created after a successful create', async () => {
    create.mockResolvedValue({ id: 'e1' })
    await createEvent('t1', validInput)

    expect(inngestSend).toHaveBeenCalledWith({
      name: 'app/truck.event-created',
      data: { truckId: 't1', eventId: 'e1' },
    })
  })

  it('geocodes the address and sets geom on a successful match', async () => {
    create.mockResolvedValue({ id: 'e1' })
    geocodeAddress.mockResolvedValue({ lat: 30.27, lng: -97.74 })

    await createEvent('t1', { ...validInput, address: '123 Main St' })

    expect(geocodeAddress).toHaveBeenCalledWith('123 Main St')
    expect(executeRaw).toHaveBeenCalledTimes(1)
  })

  it('never blocks creation when geocoding finds no match', async () => {
    create.mockResolvedValue({ id: 'e1' })
    geocodeAddress.mockResolvedValue(null)

    await expect(createEvent('t1', { ...validInput, address: 'nonsense' })).resolves.toEqual({ id: 'e1' })
    expect(executeRaw).not.toHaveBeenCalled()
  })
})

describe('updateEvent', () => {
  it('throws when the event does not belong to this truck (0 rows affected)', async () => {
    updateMany.mockResolvedValue({ count: 0 })
    await expect(updateEvent('t1', 'e1', validInput)).rejects.toThrow('not found')
  })

  it('scopes the update by truckId, not just eventId', async () => {
    updateMany.mockResolvedValue({ count: 1 })
    await updateEvent('t1', 'e1', validInput)

    const call = updateMany.mock.calls.at(0)?.at(0)
    expect(call.where).toEqual({ id: 'e1', truckId: 't1' })
  })

  it('clears geom when the address is removed', async () => {
    updateMany.mockResolvedValue({ count: 1 })
    await updateEvent('t1', 'e1', { ...validInput, address: null })

    expect(geocodeAddress).not.toHaveBeenCalled()
    expect(executeRaw).toHaveBeenCalledTimes(1) // the clear-geom raw update
  })

  it('re-geocodes and clears geom when the new address has no match', async () => {
    updateMany.mockResolvedValue({ count: 1 })
    geocodeAddress.mockResolvedValue(null)

    await updateEvent('t1', 'e1', { ...validInput, address: 'nonsense' })

    expect(executeRaw).toHaveBeenCalledTimes(1) // the clear-geom raw update
  })
})

describe('deleteEvent', () => {
  it('scopes the delete by truckId, not just eventId', async () => {
    deleteMany.mockResolvedValue({ count: 1 })
    await deleteEvent('t1', 'e1')
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'e1', truckId: 't1' } })
  })

  it('throws when the event does not belong to this truck', async () => {
    deleteMany.mockResolvedValue({ count: 0 })
    await expect(deleteEvent('t1', 'e1')).rejects.toThrow('not found')
  })
})
