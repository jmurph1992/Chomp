// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { SignedInSafe } from './signed-in-safe'

describe('SignedInSafe', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE
  })

  it('renders nothing in demo mode, without needing a ClerkProvider', () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true'

    const { container } = render(
      <SignedInSafe>
        <button>Favorite</button>
      </SignedInSafe>,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('delegates to <SignedIn> outside demo mode', () => {
    // No ClerkProvider is mounted in this test file, so <SignedIn> throwing
    // here is proof it's actually being rendered rather than bypassed.
    expect(() =>
      render(
        <SignedInSafe>
          <button>Favorite</button>
        </SignedInSafe>,
      ),
    ).toThrow(/ClerkProvider/)
  })
})
