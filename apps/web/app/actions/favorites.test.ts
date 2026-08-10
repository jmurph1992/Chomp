import { describe, it, expect, vi, beforeEach } from 'vitest'

const getCurrentUser = vi.fn()
const favoriteTruck = vi.fn()
const unfavoriteTruck = vi.fn()
const favoriteMenuItem = vi.fn()
const unfavoriteMenuItem = vi.fn()
const revalidatePath = vi.fn()

vi.mock('@/lib/auth', () => ({ getCurrentUser }))
vi.mock('@/lib/favorites', () => ({
  favoriteTruck,
  unfavoriteTruck,
  favoriteMenuItem,
  unfavoriteMenuItem,
}))
vi.mock('next/cache', () => ({ revalidatePath }))

const {
  favoriteTruckAction,
  unfavoriteTruckAction,
  favoriteMenuItemAction,
  unfavoriteMenuItemAction,
} = await import('./favorites')

beforeEach(() => {
  getCurrentUser.mockReset()
  favoriteTruck.mockReset()
  unfavoriteTruck.mockReset()
  favoriteMenuItem.mockReset()
  unfavoriteMenuItem.mockReset()
  revalidatePath.mockReset()
})

describe('favoriteTruckAction', () => {
  it('rejects when signed out, without writing', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(favoriteTruckAction('t1', 'taco-kings')).rejects.toThrow('Sign in required')
    expect(favoriteTruck).not.toHaveBeenCalled()
  })

  it('favorites for a signed-in user and revalidates the truck page and account', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    await favoriteTruckAction('t1', 'taco-kings')

    expect(favoriteTruck).toHaveBeenCalledWith('u1', 't1')
    expect(revalidatePath).toHaveBeenCalledWith('/trucks/taco-kings')
    expect(revalidatePath).toHaveBeenCalledWith('/account')
  })
})

describe('unfavoriteTruckAction', () => {
  it('rejects when signed out, without writing', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(unfavoriteTruckAction('t1', 'taco-kings')).rejects.toThrow('Sign in required')
    expect(unfavoriteTruck).not.toHaveBeenCalled()
  })

  it('unfavorites for a signed-in user and revalidates', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    await unfavoriteTruckAction('t1', 'taco-kings')

    expect(unfavoriteTruck).toHaveBeenCalledWith('u1', 't1')
    expect(revalidatePath).toHaveBeenCalledWith('/trucks/taco-kings')
    expect(revalidatePath).toHaveBeenCalledWith('/account')
  })
})

describe('favoriteMenuItemAction', () => {
  it('rejects when signed out, without writing', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(favoriteMenuItemAction('t1', 'taco-kings', 'i1')).rejects.toThrow(
      'Sign in required',
    )
    expect(favoriteMenuItem).not.toHaveBeenCalled()
  })

  it('favorites for a signed-in user and revalidates', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    await favoriteMenuItemAction('t1', 'taco-kings', 'i1')

    expect(favoriteMenuItem).toHaveBeenCalledWith('u1', 't1', 'i1')
    expect(revalidatePath).toHaveBeenCalledWith('/trucks/taco-kings')
    expect(revalidatePath).toHaveBeenCalledWith('/account')
  })
})

describe('unfavoriteMenuItemAction', () => {
  it('rejects when signed out, without writing', async () => {
    getCurrentUser.mockResolvedValue(null)
    await expect(unfavoriteMenuItemAction('t1', 'taco-kings', 'i1')).rejects.toThrow(
      'Sign in required',
    )
    expect(unfavoriteMenuItem).not.toHaveBeenCalled()
  })

  it('unfavorites for a signed-in user and revalidates', async () => {
    getCurrentUser.mockResolvedValue({ id: 'u1' })
    await unfavoriteMenuItemAction('t1', 'taco-kings', 'i1')

    expect(unfavoriteMenuItem).toHaveBeenCalledWith('u1', 't1', 'i1')
    expect(revalidatePath).toHaveBeenCalledWith('/trucks/taco-kings')
    expect(revalidatePath).toHaveBeenCalledWith('/account')
  })
})
