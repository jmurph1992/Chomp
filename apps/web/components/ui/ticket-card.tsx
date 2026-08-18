import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  children: ReactNode
  className?: string
}

/**
 * The shared "ticket stub" card — see globals.css's .ticket-card /
 * .ticket-card__perforation for why this is a dotted perforation line
 * rather than a literal torn-edge cutout. Used everywhere a truck is
 * represented as a card (feed items, truck-list rows). The map popup uses
 * the same two CSS classes directly, since Mapbox popups are built with
 * raw DOM APIs, not React — see truck-map.tsx.
 */
export function TicketCard({ children, className }: Props) {
  return (
    <div className={cn('ticket-card overflow-hidden', className)}>
      <div className="ticket-card__perforation" aria-hidden="true" />
      <div className="p-4">{children}</div>
    </div>
  )
}
