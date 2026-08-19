// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TruckReviews } from './truck-reviews'

describe('TruckReviews in demo mode', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE
    delete process.env.NEXT_PUBLIC_SIGNUP_URL
  })

  it('shows a signup link instead of the Clerk sign-in prompt, without needing a ClerkProvider', () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true'
    process.env.NEXT_PUBLIC_SIGNUP_URL = 'https://chomp.app/sign-up'

    render(
      <TruckReviews
        truckId="t1"
        slug="taco-kings"
        reviews={[]}
        summary={{ averageRating: null, reviewCount: 0 }}
        ownReview={null}
      />,
    )

    const link = screen.getByRole('link', { name: 'Sign up' })
    expect(link).toHaveAttribute('href', 'https://chomp.app/sign-up')
    expect(screen.getByText(/on the live app to write a review/)).toBeInTheDocument()
  })
})
