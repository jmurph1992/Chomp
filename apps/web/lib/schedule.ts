import { db } from '@chomp/db'
import type { ScheduleEntryInput, TruckScheduleEntry } from '@chomp/types'

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

/** Full schedule for the dashboard editor — unlike the public read, includes cancelled entries. */
export async function getScheduleForEdit(truckId: string): Promise<TruckScheduleEntry[]> {
  const rows = await db.truckSchedule.findMany({
    where: { truckId },
    orderBy: [{ dayOfWeek: 'asc' }, { specificDate: 'asc' }],
  })
  return rows.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    specificDate: s.specificDate ? s.specificDate.toISOString() : null,
    startTime: s.startTime ? s.startTime.toISOString() : null,
    endTime: s.endTime ? s.endTime.toISOString() : null,
    locationNote: s.locationNote,
    address: s.address,
    isCancelled: s.isCancelled,
  }))
}

// ─── Dashboard CRUD ───────────────────────────────────────────────────────────
// Scoped by truckId for the same IDOR reason as the menu CRUD in lib/menu.ts —
// see that file's comment for the full rationale.

function toScheduleData(input: ScheduleEntryInput) {
  return {
    dayOfWeek: input.dayOfWeek,
    specificDate: input.specificDate ? new Date(input.specificDate) : null,
    startTime: input.startTime ? new Date(input.startTime) : null,
    endTime: input.endTime ? new Date(input.endTime) : null,
    locationNote: input.locationNote,
    address: input.address,
    isCancelled: input.isCancelled,
  }
}

export async function createScheduleEntry(truckId: string, input: ScheduleEntryInput) {
  return db.truckSchedule.create({
    data: { truckId, ...toScheduleData(input) },
  })
}

export async function updateScheduleEntry(
  truckId: string,
  entryId: string,
  input: ScheduleEntryInput,
): Promise<void> {
  const result = await db.truckSchedule.updateMany({
    where: { id: entryId, truckId },
    data: toScheduleData(input),
  })
  if (result.count === 0) throw new Error('Schedule entry not found')
}

export async function deleteScheduleEntry(truckId: string, entryId: string): Promise<void> {
  const result = await db.truckSchedule.deleteMany({ where: { id: entryId, truckId } })
  if (result.count === 0) throw new Error('Schedule entry not found')
}
