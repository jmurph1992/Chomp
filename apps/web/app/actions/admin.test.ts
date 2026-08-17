import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireAdmin = vi.fn()
const verifyTruck = vi.fn()
const rejectTruck = vi.fn()
const holdTruck = vi.fn()
const setReviewVisibility = vi.fn()
const resolveContentReport = vi.fn()
const dismissContentReport = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/admin', () => ({ requireAdmin }))
vi.mock('@/lib/trucks', () => ({ verifyTruck, rejectTruck, holdTruck }))
vi.mock('@/lib/reviews', () => ({ setReviewVisibility }))
vi.mock('@/lib/reports', () => ({ resolveContentReport, dismissContentReport }))
vi.mock('next/cache', () => ({ revalidatePath }))

const {
  verifyTruckAction,
  rejectTruckAction,
  holdTruckAction,
  hideReviewAction,
  unhideReviewAction,
  resolveContentReportAction,
  dismissContentReportAction,
} = await import('./admin')

beforeEach(() => {
  requireAdmin.mockReset()
  verifyTruck.mockReset()
  rejectTruck.mockReset()
  holdTruck.mockReset()
  setReviewVisibility.mockReset()
  resolveContentReport.mockReset()
  dismissContentReport.mockReset()
  revalidatePath.mockReset()
})

describe('verifyTruckAction', () => {
  it('rejects a non-admin, without writing', async () => {
    requireAdmin.mockRejectedValue(new Error('Not authorized'))
    await expect(verifyTruckAction('t1', 'taco-kings')).rejects.toThrow('Not authorized')
    expect(verifyTruck).not.toHaveBeenCalled()
  })

  it('verifies for an admin and revalidates the public pages', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', role: 'admin' })
    await verifyTruckAction('t1', 'taco-kings')

    expect(verifyTruck).toHaveBeenCalledWith('t1')
    expect(revalidatePath).toHaveBeenCalledWith('/trucks/taco-kings')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })
})

describe('rejectTruckAction', () => {
  it('rejects a non-admin, without writing', async () => {
    requireAdmin.mockRejectedValue(new Error('Not authorized'))
    await expect(rejectTruckAction('t1', 'taco-kings', 'Fake')).rejects.toThrow('Not authorized')
    expect(rejectTruck).not.toHaveBeenCalled()
  })

  it('rejects the truck with the given reason for an admin', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', role: 'admin' })
    await rejectTruckAction('t1', 'taco-kings', 'Fake business')

    expect(rejectTruck).toHaveBeenCalledWith('t1', 'Fake business')
  })
})

describe('holdTruckAction', () => {
  it('rejects a non-admin, without writing', async () => {
    requireAdmin.mockRejectedValue(new Error('Not authorized'))
    await expect(holdTruckAction('t1', 'taco-kings', 'Complaint')).rejects.toThrow('Not authorized')
    expect(holdTruck).not.toHaveBeenCalled()
  })

  it('holds the truck with the given reason for an admin', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', role: 'admin' })
    await holdTruckAction('t1', 'taco-kings', 'Health code complaint')

    expect(holdTruck).toHaveBeenCalledWith('t1', 'Health code complaint')
  })
})

describe('hideReviewAction', () => {
  it('rejects a non-admin, without writing', async () => {
    requireAdmin.mockRejectedValue(new Error('Not authorized'))
    await expect(hideReviewAction('r1', 'taco-kings', 'Spam')).rejects.toThrow('Not authorized')
    expect(setReviewVisibility).not.toHaveBeenCalled()
  })

  it('hides the review with the given reason and moderator id, and revalidates', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', role: 'admin' })
    await hideReviewAction('r1', 'taco-kings', 'Spam')

    expect(setReviewVisibility).toHaveBeenCalledWith('r1', false, 'Spam', 'admin1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/reviews')
    expect(revalidatePath).toHaveBeenCalledWith('/trucks/taco-kings')
  })
})

describe('unhideReviewAction', () => {
  it('rejects a non-admin, without writing', async () => {
    requireAdmin.mockRejectedValue(new Error('Not authorized'))
    await expect(unhideReviewAction('r1', 'taco-kings', 'False positive')).rejects.toThrow(
      'Not authorized',
    )
    expect(setReviewVisibility).not.toHaveBeenCalled()
  })

  it('unhides the review with the given reason and moderator id, and revalidates', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', role: 'admin' })
    await unhideReviewAction('r1', 'taco-kings', 'False positive')

    expect(setReviewVisibility).toHaveBeenCalledWith('r1', true, 'False positive', 'admin1')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/reviews')
    expect(revalidatePath).toHaveBeenCalledWith('/trucks/taco-kings')
  })
})

describe('resolveContentReportAction', () => {
  it('rejects a non-admin, without writing', async () => {
    requireAdmin.mockRejectedValue(new Error('Not authorized'))
    await expect(resolveContentReportAction('rep1', 'Confirmed spam')).rejects.toThrow('Not authorized')
    expect(resolveContentReport).not.toHaveBeenCalled()
  })

  it('resolves with the admin id and revalidates', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', role: 'admin' })
    await resolveContentReportAction('rep1', 'Confirmed spam')

    expect(resolveContentReport).toHaveBeenCalledWith('rep1', 'admin1', 'Confirmed spam')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/reports')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/reviews')
  })
})

describe('dismissContentReportAction', () => {
  it('rejects a non-admin, without writing', async () => {
    requireAdmin.mockRejectedValue(new Error('Not authorized'))
    await expect(dismissContentReportAction('rep1', 'Not actionable')).rejects.toThrow('Not authorized')
    expect(dismissContentReport).not.toHaveBeenCalled()
  })

  it('dismisses with the admin id and revalidates', async () => {
    requireAdmin.mockResolvedValue({ id: 'admin1', role: 'admin' })
    await dismissContentReportAction('rep1', 'Not actionable')

    expect(dismissContentReport).toHaveBeenCalledWith('rep1', 'admin1', 'Not actionable')
    expect(revalidatePath).toHaveBeenCalledWith('/admin/reports')
  })
})
