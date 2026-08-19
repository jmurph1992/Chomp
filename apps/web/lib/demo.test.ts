import { afterEach, describe, expect, it } from 'vitest'
import { isDemoMode, signupUrl } from './demo'

describe('isDemoMode', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE
  })

  it('is false when unset', () => {
    expect(isDemoMode()).toBe(false)
  })

  it('is true only for the exact string "true"', () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true'
    expect(isDemoMode()).toBe(true)

    process.env.NEXT_PUBLIC_DEMO_MODE = '1'
    expect(isDemoMode()).toBe(false)
  })
})

describe('signupUrl', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SIGNUP_URL
  })

  it('falls back to the local sign-up route when unset', () => {
    expect(signupUrl()).toBe('/sign-up')
  })

  it('returns the configured URL when set', () => {
    process.env.NEXT_PUBLIC_SIGNUP_URL = 'https://chomp.app/sign-up'
    expect(signupUrl()).toBe('https://chomp.app/sign-up')
  })
})
