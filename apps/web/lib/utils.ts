import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind class names and resolves conflicts.
 * Required by shadcn/ui — used throughout the component library.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
