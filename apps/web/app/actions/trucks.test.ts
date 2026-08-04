import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUser = vi.fn()
const requireOperator = vi.fn()
const createTruck = vi.fn()
const updateTruckProfile = vi.fn()
const getNearbyTrucks = vi.fn()
const revalidatePath = vi.fn()
const checkRateLimit = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser }))
vi.mock('@/lib/operators', () => ({ requireOperator }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit, truckCreationLimiter: {} }))
vi.mock('@/lib/trucks', () => ({ createTruck, updateTruckProfile, getNearbyTrucks }))
vi.mock('@/lib/geo', () => ({
  DEFAULT_RADIUS_METERS: 16093,
  isValidLat: (v: number) => v >= -90 && v <= 90,
  isValidLng: (v: number) => v >= -180 && v <= 180,
}))
vi.mock('next/cache', () => ({ revalidatePath }))

const { createTruckAction, updateTruckProfileAction, getNearbyTrucksAction } = await import(
  './trucks'
)

describe('createTruckAction', () => {
  beforeEach(() => {
    getCurrentUser.mockReset()
    createTruck.mockReset()
    revalidatePath.mockReset()
    checkRateLimit.mockReset().mockResolvedValue(undefined)
  })

  it('rejects when signed out, without creating anything', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(
      createTruckAction({ name: 'Taco Kings', description: null, cuisineType: [] }),
    ).rejects.toThrow('Sign in required')
    expect(createTruck).not.toHaveBeenCalled()
  })

  it('rejects when the caller has hit the truck-creation rate limit, without creating anything', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', role: 'customer' })
    checkRateLimit.mockRejectedValue(new Error("You're doing that too often — try again in a bit."))

    await expect(
      createTruckAction({ name: 'Taco Kings', description: null, cuisineType: [] }),
    ).rejects.toThrow('too often')
    expect(createTruck).not.toHaveBeenCalled()
  })

  it('creates the truck as the signed-in user and returns it', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', role: 'customer' })
    createTruck.mockResolvedValue({ id: 't1', slug: 'taco-kings' })

    const result = await createTruckAction({ name: 'Taco Kings', description: null, cuisineType: [] })

    expect(checkRateLimit).toHaveBeenCalledWith(expect.anything(), 'u1')
    expect(createTruck).toHaveBeenCalledWith(
      { id: 'u1', role: 'customer' },
      { name: 'Taco Kings', description: null, cuisineType: [] },
    )
    expect(result).toEqual({ id: 't1', slug: 'taco-kings' })
  })
})

describe('updateTruckProfileAction', () => {
  beforeEach(() => {
    requireOperator.mockReset()
    updateTruckProfile.mockReset()
    revalidatePath.mockReset()
  })

  const input = {
    name: 'Taco Kings',
    description: null,
    cuisineType: [],
    phone: null,
    website: null,
    instagram: null,
    logoUrl: null,
    coverUrl: null,
    isActive: true,
  }

  it('rejects when the caller is not an operator of this truck, without updating', async () => {
    requireOperator.mockRejectedValue(new Error('Not authorized to manage this truck'))

    await expect(updateTruckProfileAction('t1', 'taco-kings', input)).rejects.toThrow(
      'Not authorized',
    )
    expect(updateTruckProfile).not.toHaveBeenCalled()
  })

  it('updates when the caller is an authorized operator', async () => {
    requireOperator.mockResolvedValue({ user: { id: 'u1' }, role: 'owner' })
    updateTruckProfile.mockResolvedValue(undefined)

    await updateTruckProfileAction('t1', 'taco-kings', input)

    expect(updateTruckProfile).toHaveBeenCalledWith('t1', input)
  })
})

describe('getNearbyTrucksAction', () => {
  beforeEach(() => getNearbyTrucks.mockReset())

  it('returns an empty array for invalid coordinates without querying', async () => {
    const result = await getNearbyTrucksAction(999, 0)
    expect(result).toEqual([])
    expect(getNearbyTrucks).not.toHaveBeenCalled()
  })
})
