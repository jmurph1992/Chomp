// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SiteHeader } from './site-header'

describe('SiteHeader in demo mode', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE
    delete process.env.NEXT_PUBLIC_SIGNUP_URL
  })

  it('shows a signup link instead of the Clerk sign-in button, without needing a ClerkProvider', () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true'
    process.env.NEXT_PUBLIC_SIGNUP_URL = 'https://chomp.app/sign-up'

    render(<SiteHeader navLinks={[]} />)

    const link = screen.getByRole('link', { name: 'Sign up' })
    expect(link).toHaveAttribute('href', 'https://chomp.app/sign-up')
  })
})
