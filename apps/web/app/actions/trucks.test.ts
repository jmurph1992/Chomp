import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUser = vi.fn()
const requireOperator = vi.fn()
const createTruck = vi.fn()
const updateTruckProfile = vi.fn()
const deleteTruck = vi.fn()
const getNearbyTrucks = vi.fn()
const revalidatePath = vi.fn()
const checkRateLimit = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser }))
vi.mock('@/lib/operators', () => ({ requireOperator }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit, truckCreationLimiter: {} }))
vi.mock('@/lib/trucks', () => ({ createTruck, updateTruckProfile, deleteTruck, getNearbyTrucks }))
vi.mock('@/lib/geo', () => ({
  DEFAULT_RADIUS_METERS: 16093,
  isValidLat: (v: number) => v >= -90 && v <= 90,
  isValidLng: (v: number) => v >= -180 && v <= 180,
}))
vi.mock('next/cache', () => ({ revalidatePath }))

const { createTruckAction, updateTruckProfileAction, deleteTruckAction, getNearbyTrucksAction } =
  await import('./trucks')

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

describe('deleteTruckAction', () => {
  beforeEach(() => {
    requireOperator.mockReset()
    deleteTruck.mockReset()
    revalidatePath.mockReset()
  })

  it('rejects a non-operator, without deleting', async () => {
    requireOperator.mockRejectedValue(new Error('Not authorized to manage this truck'))
    await expect(deleteTruckAction('t1', 'Taco Kings')).rejects.toThrow('Not authorized')
    expect(deleteTruck).not.toHaveBeenCalled()
  })

  it('rejects a manager (owner-only action), without deleting', async () => {
    requireOperator.mockResolvedValue({ user: { id: 'mgr1' }, role: 'manager' })
    await expect(deleteTruckAction('t1', 'Taco Kings')).rejects.toThrow('Only the truck owner')
    expect(deleteTruck).not.toHaveBeenCalled()
  })

  it('deletes for an owner and revalidates the dashboard and map', async () => {
    requireOperator.mockResolvedValue({ user: { id: 'owner1' }, role: 'owner' })
    deleteTruck.mockResolvedValue(undefined)

    await deleteTruckAction('t1', 'Taco Kings')

    expect(deleteTruck).toHaveBeenCalledWith('t1', 'Taco Kings')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('propagates a name-mismatch error from deleteTruck unchanged', async () => {
    requireOperator.mockResolvedValue({ user: { id: 'owner1' }, role: 'owner' })
    deleteTruck.mockRejectedValue(new Error('Truck name does not match — deletion cancelled'))

    await expect(deleteTruckAction('t1', 'wrong')).rejects.toThrow('does not match')
  })
})

describe('getNearbyTrucksAction', () => {
  beforeEach(() => {
    getNearbyTrucks.mockReset()
    getCurrentUser.mockReset()
  })

  it('returns an empty array for invalid coordinates without querying', async () => {
    const result = await getNearbyTrucksAction(999, 0)
    expect(result).toEqual([])
    expect(getNearbyTrucks).not.toHaveBeenCalled()
  })

  it('resolves the current viewer and passes their id through, for isFavorited', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1', role: 'customer' })
    getNearbyTrucks.mockResolvedValue([])

    await getNearbyTrucksAction(30.2672, -97.7431)

    expect(getNearbyTrucks).toHaveBeenCalledWith(30.2672, -97.7431, 16093, 'u1')
  })

  it('passes undefined for a signed-out viewer, not a fabricated id', async () => {
    getCurrentUser.mockResolvedValue(null)
    getNearbyTrucks.mockResolvedValue([])

    await getNearbyTrucksAction(30.2672, -97.7431)

    expect(getNearbyTrucks).toHaveBeenCalledWith(30.2672, -97.7431, 16093, undefined)
  })
})
