// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoBanner } from './demo-banner'

describe('DemoBanner', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE
    delete process.env.NEXT_PUBLIC_SIGNUP_URL
  })

  it('renders nothing outside demo mode', () => {
    const { container } = render(<DemoBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a signup link pointing at the configured URL in demo mode', () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true'
    process.env.NEXT_PUBLIC_SIGNUP_URL = 'https://chomp.app/sign-up'

    render(<DemoBanner />)

    const link = screen.getByRole('link', { name: /sign up on the real app/i })
    expect(link).toHaveAttribute('href', 'https://chomp.app/sign-up')
  })
})
