/**
 * "Open now" — is the current truck-local time inside one of today's
 * posted, non-cancelled TruckSchedule windows. Pure/framework-agnostic,
 * same convention as location-freshness.ts. Deliberately independent of
 * that file's "Active now": this is about whether the truck is inside its
 * posted weekly hours, not whether the operator has a live, unexpired
 * location report — see docs/features/operator-dashboard.md#location-updates
 * for why those two concepts are kept apart.
 */

export type OpenNowScheduleEntry = {
  dayOfWeek: number | null
  specificDate: string | null // ISO
  /**
   * ISO, but only the wall-clock hour/minute is meaningful — these are
   * literal "the operator typed 11:00" readings (stored as
   * 1970-01-01T11:00:00.000Z), never real timezone-aware instants. Read
   * via getUTCHours/getUTCMinutes, not local getters.
   */
  startTime: string | null
  endTime: string | null
  isCancelled: boolean
}

export type OpenNowStatus =
  | { status: 'open'; closesAt: string }
  | { status: 'closed' }
  | { status: 'unknown' }

function minutesOfDayUtc(iso: string): number {
  const d = new Date(iso)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/**
 * Weekday/date/minutes-of-day for `now` as observed in `timezone`, via
 * Intl's formatToParts — never string-parses toLocaleString output.
 * Exported for lib/schedule.ts#getTodaysScheduleEntries, which needs the
 * same "what day/date is it in this truck's zone" computation this file
 * needs — one shared primitive, not two copies of the same Intl call.
 */
export function getLocalDateParts(
  now: Date,
  timezone: string,
): { dayOfWeek: number; date: string; minutesOfDay: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]))

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayOfWeek = WEEKDAYS.indexOf(parts.weekday!)
  const date = `${parts.year}-${parts.month}-${parts.day}`
  const minutesOfDay = Number(parts.hour) * 60 + Number(parts.minute)

  return { dayOfWeek, date, minutesOfDay }
}

/**
 * Same-day windows only — an entry with endTime before startTime (crossing
 * midnight, e.g. 10pm-2am) isn't specially handled; correct handling would
 * need to also check *yesterday's* dayOfWeek entry once past midnight,
 * real added complexity for a genuinely edge-case schedule shape. No
 * "opens at X" for the closed state either — that needs a forward scan
 * across days/entries, out of scope for this pass.
 */
export function getOpenNowStatus(
  schedule: OpenNowScheduleEntry[],
  timezone: string | null,
  now: Date = new Date(),
): OpenNowStatus {
  if (timezone === null) return { status: 'unknown' }

  const local = getLocalDateParts(now, timezone)

  const todaysEntries = schedule.filter((entry) => {
    if (entry.isCancelled) return false
    if (entry.specificDate) return entry.specificDate.slice(0, 10) === local.date
    return entry.dayOfWeek === local.dayOfWeek
  })

  for (const entry of todaysEntries) {
    if (!entry.startTime || !entry.endTime) continue
    const start = minutesOfDayUtc(entry.startTime)
    const end = minutesOfDayUtc(entry.endTime)
    if (local.minutesOfDay >= start && local.minutesOfDay < end) {
      return { status: 'open', closesAt: entry.endTime }
    }
  }

  return { status: 'closed' }
}
