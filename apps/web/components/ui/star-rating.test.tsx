// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { getFilledStarCount, StarRating } from './star-rating'

describe('getFilledStarCount', () => {
  it('rounds to the nearest whole star', () => {
    expect(getFilledStarCount(4)).toBe(4)
    expect(getFilledStarCount(4.3)).toBe(4)
    expect(getFilledStarCount(4.6)).toBe(5)
  })

  it('clamps to the 0-5 range', () => {
    expect(getFilledStarCount(0)).toBe(0)
    expect(getFilledStarCount(-1)).toBe(0)
    expect(getFilledStarCount(6)).toBe(5)
  })
})

describe('StarRating', () => {
  it('renders an accessible label matching the rating', () => {
    render(<StarRating rating={4} />)
    expect(screen.getByRole('img', { name: '4 out of 5 stars' })).toBeInTheDocument()
  })

  it('renders exactly 5 star icons regardless of rating', () => {
    const { container } = render(<StarRating rating={2} />)
    expect(container.querySelectorAll('svg')).toHaveLength(5)
  })

  it('fills only as many stars as the rating, rounded', () => {
    const { container } = render(<StarRating rating={3.6} />)
    const stars = container.querySelectorAll('svg')
    const filled = Array.from(stars).filter((s) => s.classList.contains('fill-marigold'))
    expect(filled).toHaveLength(4)
  })

  it('renders the optional label text', () => {
    render(<StarRating rating={4.3} label="4.3 (12 reviews)" />)
    expect(screen.getByText('4.3 (12 reviews)')).toBeInTheDocument()
  })

  it('renders no label element when omitted', () => {
    const { container } = render(<StarRating rating={4} />)
    expect(container.querySelector('.text-muted-foreground')).toBeNull()
  })
})
