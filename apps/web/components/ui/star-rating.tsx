import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_STARS = 5

/**
 * Pure so the fill logic can be unit-tested without rendering anything.
 * Rounds to the nearest whole star — every review rating in this app is
 * already an integer 1-5 (see isValidRating), so only a truck-level
 * average can be fractional, and a half-star render wasn't asked for.
 */
export function getFilledStarCount(rating: number): number {
  return Math.min(MAX_STARS, Math.max(0, Math.round(rating)))
}

type Props = {
  rating: number
  /** Optional trailing text, e.g. "4.3 (12 reviews)" or "(12)". */
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

/** Shared star display for every place a rating is shown — feed, truck
 * detail, account, and admin. Previously each of those printed a plain
 * "{rating} ★" string (one static glyph regardless of the actual rating);
 * this renders all 5 stars, filled up to the real value. */
export function StarRating({ rating, label, size = 'sm', className }: Props) {
  const filledCount = getFilledStarCount(rating)
  const starSize = size === 'md' ? 'size-5' : 'size-3.5'

  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      role="img"
      aria-label={`${rating} out of 5 stars`}
    >
      <span className="flex items-center gap-0.5">
        {Array.from({ length: MAX_STARS }, (_, i) => (
          <Star
            key={i}
            aria-hidden="true"
            className={cn(
              starSize,
              i < filledCount ? 'fill-marigold text-marigold' : 'fill-transparent text-char',
            )}
          />
        ))}
      </span>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </span>
  )
}
