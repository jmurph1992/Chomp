import { describe, it, expect } from 'vitest'
import { safeRedirectPath } from './redirect'

describe('safeRedirectPath', () => {
  it('accepts a same-origin relative path', () => {
    expect(safeRedirectPath('/invite/abc')).toBe('/invite/abc')
  })

  it('returns null for undefined input', () => {
    expect(safeRedirectPath(undefined)).toBeNull()
  })

  it('rejects an absolute URL', () => {
    expect(safeRedirectPath('https://evil.com')).toBeNull()
  })

  it('rejects a protocol-relative URL', () => {
    expect(safeRedirectPath('//evil.com')).toBeNull()
  })

  it('rejects a path with no leading slash', () => {
    expect(safeRedirectPath('evil.com')).toBeNull()
  })
})
