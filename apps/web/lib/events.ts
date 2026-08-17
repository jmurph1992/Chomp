import { db } from '@chomp/db'
import type { TruckEventInput, TruckEventView } from '@chomp/types'
import { geocodeAddress } from './geocoding'
import { inngest } from '@/inngest/client'

/** Just the title, for the new-event notification email — no-ops the caller if the event was deleted before the Inngest function ran. */
export async function getEventTitle(eventId: string): Promise<{ title: string } | null> {
  return db.truckEvent.findUnique({ where: { id: eventId }, select: { title: true } })
}

/** Full event list for the dashboard editor — past and future, the operator should see everything they created. */
export async function getEventsForEdit(truckId: string): Promise<TruckEventView[]> {
  const rows = await db.truckEvent.findMany({
    where: { truckId },
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    address: row.address,
    // geom is Unsupported() in Prisma, and irrelevant to the editor anyway —
    // the dashboard shows/edits the typed address, not a map pin.
    lat: null,
    lng: null,
  }))
}

type UpcomingEventRow = {
  id: string
  title: string
  description: string | null
  startsAt: Date | null
  endsAt: Date | null
  address: string | null
  lat: number | null
  lng: number | null
}

/**
 * Events still relevant to show publicly on a truck's own page: no end date
 * (an evergreen announcement), or an end date that hasn't passed yet — same
 * "still current" framing lib/locations.ts#postLocation's activation check
 * uses for expiresAt. A second raw-SQL read (not a Prisma findMany) since
 * geom is Unsupported() and coordinates are needed here for Get Directions,
 * same reason lib/trucks.ts#getTruckBySlug runs a small second raw query.
 */
export async function getUpcomingEventsForTruck(truckId: string): Promise<TruckEventView[]> {
  const rows = await db.$queryRaw<UpcomingEventRow[]>`
    SELECT
      id, title, description,
      starts_at AS "startsAt", ends_at AS "endsAt", address,
      ST_Y(geom::geometry) AS "lat", ST_X(geom::geometry) AS "lng"
    FROM truck_events
    WHERE truck_id = ${truckId} AND (ends_at IS NULL OR ends_at >= now())
    ORDER BY starts_at ASC NULLS LAST, created_at ASC
  `
  return rows.map(mapUpcomingRow)
}

/**
 * Cross-truck version of the same "upcoming" filter for the public feed's
 * live events section — joined to trucks and filtered to the same
 * isActive/verificationStatus gate getTruckBySlug/getNearbyTrucks already
 * enforce, so a deactivated or unverified truck's event can't leak into the
 * feed even though this bypasses the feed_items materialized view entirely.
 */
export async function getUpcomingEventsForFeed(
  limit: number,
): Promise<(TruckEventView & { truckSlug: string; truckName: string })[]> {
  const rows = await db.$queryRaw<(UpcomingEventRow & { truckSlug: string; truckName: string })[]>`
    SELECT
      te.id, te.title, te.description,
      te.starts_at AS "startsAt", te.ends_at AS "endsAt", te.address,
      ST_Y(te.geom::geometry) AS "lat", ST_X(te.geom::geometry) AS "lng",
      t.slug AS "truckSlug", t.name AS "truckName"
    FROM truck_events te
    JOIN trucks t ON t.id = te.truck_id
    WHERE (te.ends_at IS NULL OR te.ends_at >= now())
      AND t.is_active = true AND t.verification_status = 'verified'
    ORDER BY te.starts_at ASC NULLS LAST, te.created_at ASC
    LIMIT ${limit}
  `
  return rows.map((row) => ({ ...mapUpcomingRow(row), truckSlug: row.truckSlug, truckName: row.truckName }))
}

function mapUpcomingRow(row: UpcomingEventRow): TruckEventView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : null,
    endsAt: row.endsAt ? new Date(row.endsAt).toISOString() : null,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
  }
}

// ─── Dashboard CRUD ───────────────────────────────────────────────────────────
// Scoped by truckId for the same IDOR reason as the menu CRUD in lib/menu.ts —
// see that file's comment for the full rationale.

function validateEventInput(input: TruckEventInput): void {
  if (!input.title.trim()) throw new Error('Title is required')
  if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new Error('End time must be after start time')
  }
}

/**
 * Creates the event row first (geom is Unsupported() — Prisma create simply
 * omits it, leaving the column NULL), then geocodes the address and, on a
 * hit, sets geom via a follow-up raw UPDATE — same two-step, raw-SQL-for-geom
 * pattern lib/locations.ts#postLocation uses for its INSERT. A geocoding miss
 * or failure never blocks creation; the event just has no pin yet.
 */
export async function createEvent(truckId: string, input: TruckEventInput) {
  validateEventInput(input)

  const event = await db.truckEvent.create({
    data: {
      truckId,
      title: input.title.trim(),
      description: input.description,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      address: input.address,
    },
  })

  if (input.address) {
    const coords = await geocodeAddress(input.address)
    if (coords) await setEventGeom(truckId, event.id, coords)
  }

  // Fire-and-forget, after the row exists — no transaction-racing concern
  // here (unlike postLocation's activation check), since there's no prior
  // state this needs to read atomically with the write.
  await inngest.send({ name: 'app/truck.event-created', data: { truckId, eventId: event.id } })

  return event
}

export async function updateEvent(truckId: string, eventId: string, input: TruckEventInput): Promise<void> {
  validateEventInput(input)

  const result = await db.truckEvent.updateMany({
    where: { id: eventId, truckId },
    data: {
      title: input.title.trim(),
      description: input.description,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      address: input.address,
    },
  })
  if (result.count === 0) throw new Error('Event not found')

  if (input.address) {
    const coords = await geocodeAddress(input.address)
    if (coords) await setEventGeom(truckId, eventId, coords)
    else await clearEventGeom(truckId, eventId)
  } else {
    await clearEventGeom(truckId, eventId)
  }
}

export async function deleteEvent(truckId: string, eventId: string): Promise<void> {
  const result = await db.truckEvent.deleteMany({ where: { id: eventId, truckId } })
  if (result.count === 0) throw new Error('Event not found')
}

async function setEventGeom(
  truckId: string,
  eventId: string,
  coords: { lat: number; lng: number },
): Promise<void> {
  await db.$executeRaw`
    UPDATE truck_events
    SET geom = ST_MakePoint(${coords.lng}, ${coords.lat})::geography
    WHERE id = ${eventId} AND truck_id = ${truckId}
  `
}

async function clearEventGeom(truckId: string, eventId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE truck_events SET geom = NULL WHERE id = ${eventId} AND truck_id = ${truckId}
  `
}
