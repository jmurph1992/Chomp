import { describe, it, expect } from 'vitest'
import { appendToNavHistory, hasInAppHistory, MAX_NAV_HISTORY } from './nav-history'

describe('appendToNavHistory', () => {
  it('appends a new pathname to the stack', () => {
    expect(appendToNavHistory(['/'], '/feed')).toEqual(['/', '/feed'])
  })

  it('starts a stack from empty', () => {
    expect(appendToNavHistory([], '/')).toEqual(['/'])
  })

  it('dedupes a consecutive repeat of the current page', () => {
    expect(appendToNavHistory(['/', '/feed'], '/feed')).toEqual(['/', '/feed'])
  })

  it('caps the stack at MAX_NAV_HISTORY, dropping the oldest entries', () => {
    const stack = Array.from({ length: MAX_NAV_HISTORY }, (_, i) => `/page-${i}`)
    const result = appendToNavHistory(stack, '/page-new')
    expect(result).toHaveLength(MAX_NAV_HISTORY)
    expect(result.at(-1)).toBe('/page-new')
    expect(result.at(0)).toBe('/page-1')
  })
})

describe('hasInAppHistory', () => {
  it('is false for an empty stack', () => {
    expect(hasInAppHistory([])).toBe(false)
  })

  it('is false for a single-entry stack (only the current page)', () => {
    expect(hasInAppHistory(['/trucks/taco-kings'])).toBe(false)
  })

  it('is true once there is a prior page to go back to', () => {
    expect(hasInAppHistory(['/feed', '/trucks/taco-kings'])).toBe(true)
  })
})
