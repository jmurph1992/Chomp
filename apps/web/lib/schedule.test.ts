import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScheduleEntryInput, TruckScheduleEntry } from '@chomp/types'

const findMany = vi.fn()
const create = vi.fn()
const updateMany = vi.fn()
const deleteMany = vi.fn()

vi.mock('@chomp/db', () => ({
  db: { truckSchedule: { findMany, create, updateMany, deleteMany } },
}))

const {
  getTodaysScheduleEntries,
  getScheduleForEdit,
  createScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
} = await import('./schedule')

function entry(overrides: Partial<TruckScheduleEntry>): TruckScheduleEntry {
  return {
    id: 'sched_1',
    dayOfWeek: null,
    specificDate: null,
    startTime: null,
    endTime: null,
    locationNote: null,
    address: null,
    isCancelled: false,
    ...overrides,
  }
}

describe('getTodaysScheduleEntries', () => {
  // Wednesday, 2026-07-29
  const wednesday = new Date('2026-07-29T12:00:00Z')

  it('includes a recurring entry matching today\'s day of week', () => {
    const result = getTodaysScheduleEntries([entry({ dayOfWeek: 3 })], wednesday)
    expect(result).toHaveLength(1)
  })

  it('excludes recurring entries for other days', () => {
    const result = getTodaysScheduleEntries([entry({ dayOfWeek: 4 })], wednesday)
    expect(result).toHaveLength(0)
  })

  it('includes a one-off entry matching the specific date, ignoring dayOfWeek', () => {
    const result = getTodaysScheduleEntries(
      [entry({ dayOfWeek: 1, specificDate: '2026-07-29T00:00:00.000Z' })],
      wednesday,
    )
    expect(result).toHaveLength(1)
  })

  it('excludes a one-off entry for a different date', () => {
    const result = getTodaysScheduleEntries(
      [entry({ specificDate: '2026-07-30T00:00:00.000Z' })],
      wednesday,
    )
    expect(result).toHaveLength(0)
  })

  it('excludes cancelled entries even if the date/day matches', () => {
    const result = getTodaysScheduleEntries([entry({ dayOfWeek: 3, isCancelled: true })], wednesday)
    expect(result).toHaveLength(0)
  })
})

const validScheduleInput: ScheduleEntryInput = {
  dayOfWeek: 2,
  specificDate: null,
  startTime: '1970-01-01T11:00:00.000Z',
  endTime: '1970-01-01T14:00:00.000Z',
  locationNote: 'Downtown',
  address: null,
  isCancelled: false,
}

describe('getScheduleForEdit', () => {
  beforeEach(() => findMany.mockReset())

  it('is not filtered by isCancelled, unlike the public read', async () => {
    findMany.mockResolvedValue([])
    await getScheduleForEdit('t1')

    const call = findMany.mock.calls.at(0)?.at(0)
    expect(call.where).toEqual({ truckId: 't1' })
  })
})

describe('createScheduleEntry', () => {
  beforeEach(() => create.mockReset())

  it('creates an entry scoped to the truck', async () => {
    create.mockResolvedValue({})
    await createScheduleEntry('t1', validScheduleInput)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ truckId: 't1', dayOfWeek: 2 }) }),
    )
  })
})

describe('updateScheduleEntry', () => {
  beforeEach(() => updateMany.mockReset())

  it('scopes the update by truckId, not just entryId', async () => {
    updateMany.mockResolvedValue({ count: 1 })
    await updateScheduleEntry('t1', 's1', validScheduleInput)

    const call = updateMany.mock.calls.at(0)?.at(0)
    expect(call.where).toEqual({ id: 's1', truckId: 't1' })
  })

  it('throws when the entry does not belong to this truck', async () => {
    updateMany.mockResolvedValue({ count: 0 })
    await expect(updateScheduleEntry('t1', 's1', validScheduleInput)).rejects.toThrow('not found')
  })
})

describe('deleteScheduleEntry', () => {
  beforeEach(() => deleteMany.mockReset())

  it('scopes the delete by truckId, not just entryId', async () => {
    deleteMany.mockResolvedValue({ count: 1 })
    await deleteScheduleEntry('t1', 's1')
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 's1', truckId: 't1' } })
  })

  it('throws when the entry does not belong to this truck', async () => {
    deleteMany.mockResolvedValue({ count: 0 })
    await expect(deleteScheduleEntry('t1', 's1')).rejects.toThrow('not found')
  })
})
