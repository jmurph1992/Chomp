import type { TruckScheduleEntry } from '@chomp/types'

/**
 * Returns schedule entries relevant to `referenceDate`'s calendar day — either a
 * recurring weekly slot for that day-of-week, or a one-off slot with a matching
 * specific date. Cancelled entries are excluded. Does not attempt to compute
 * "open now" (would require a per-truck timezone, which the schema doesn't have yet).
 */
export function getTodaysScheduleEntries(
  schedule: TruckScheduleEntry[],
  referenceDate: Date = new Date(),
): TruckScheduleEntry[] {
  const dayOfWeek = referenceDate.getDay()
  const isoDate = referenceDate.toISOString().slice(0, 10)

  return schedule.filter((entry) => {
    if (entry.isCancelled) return false
    if (entry.specificDate) return entry.specificDate.slice(0, 10) === isoDate
    return entry.dayOfWeek === dayOfWeek
  })
}
