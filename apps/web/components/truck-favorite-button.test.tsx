// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { TruckFavoriteButton } from './truck-favorite-button'

vi.mock('@/app/actions/favorites', () => ({
  favoriteTruckAction: vi.fn(),
  unfavoriteTruckAction: vi.fn(),
}))

describe('TruckFavoriteButton in demo mode', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE
  })

  it('renders nothing, without needing a ClerkProvider', () => {
    // The demo deployment never wraps the tree in <ClerkProvider>, so a
    // regression here would surface as <SignedIn> throwing at render time,
    // not just a visual difference.
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true'

    const { container } = render(
      <TruckFavoriteButton truckId="t1" slug="taco-kings" isFavorited={false} />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
