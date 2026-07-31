import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireOperator = vi.fn()
const createScheduleEntry = vi.fn()
const updateScheduleEntry = vi.fn()
const deleteScheduleEntry = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/operators', () => ({ requireOperator }))
vi.mock('@/lib/schedule', () => ({ createScheduleEntry, updateScheduleEntry, deleteScheduleEntry }))
vi.mock('next/cache', () => ({ revalidatePath }))

const { createScheduleEntryAction, updateScheduleEntryAction, deleteScheduleEntryAction } =
  await import('./schedule')

const NOT_AUTHORIZED = new Error('Not authorized to manage this truck')
const validInput = {
  dayOfWeek: 2,
  specificDate: null,
  startTime: null,
  endTime: null,
  locationNote: null,
  address: null,
  isCancelled: false,
}

beforeEach(() => {
  requireOperator.mockReset()
  createScheduleEntry.mockReset()
  updateScheduleEntry.mockReset()
  deleteScheduleEntry.mockReset()
})

describe('schedule actions', () => {
  it('createScheduleEntryAction rejects an unauthorized caller before writing', async () => {
    requireOperator.mockRejectedValue(NOT_AUTHORIZED)
    await expect(createScheduleEntryAction('t1', 'slug', validInput)).rejects.toThrow(
      'Not authorized',
    )
    expect(createScheduleEntry).not.toHaveBeenCalled()
  })

  it('createScheduleEntryAction delegates for an authorized operator', async () => {
    requireOperator.mockResolvedValue({ role: 'owner' })
    createScheduleEntry.mockResolvedValue({})
    await createScheduleEntryAction('t1', 'slug', validInput)
    expect(createScheduleEntry).toHaveBeenCalledWith('t1', validInput)
  })

  it('updateScheduleEntryAction rejects an unauthorized caller before writing', async () => {
    requireOperator.mockRejectedValue(NOT_AUTHORIZED)
    await expect(updateScheduleEntryAction('t1', 'slug', 's1', validInput)).rejects.toThrow(
      'Not authorized',
    )
    expect(updateScheduleEntry).not.toHaveBeenCalled()
  })

  it('deleteScheduleEntryAction rejects an unauthorized caller before deleting', async () => {
    requireOperator.mockRejectedValue(NOT_AUTHORIZED)
    await expect(deleteScheduleEntryAction('t1', 'slug', 's1')).rejects.toThrow('Not authorized')
    expect(deleteScheduleEntry).not.toHaveBeenCalled()
  })
})
