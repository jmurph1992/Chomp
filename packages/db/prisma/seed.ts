/**
 * Local/dev-only seed data — never run automatically. Populates a handful of
 * fake trucks around Austin, TX (matches the map's default fallback region)
 * so the map view has something to render.
 *
 * Run manually with: pnpm db:seed
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// [name, cuisine, lat, lng offset from downtown Austin]
const TRUCKS = [
  { name: 'Taco Kings', cuisine: ['mexican'], lat: 30.2672, lng: -97.7431 },
  { name: 'Pho Real', cuisine: ['vietnamese'], lat: 30.271, lng: -97.7375 },
  { name: 'Waffle Wagon', cuisine: ['breakfast', 'dessert'], lat: 30.263, lng: -97.749 },
  { name: 'Curry Up', cuisine: ['indian'], lat: 30.2755, lng: -97.7404 },
  { name: 'Smokehouse on Wheels', cuisine: ['bbq'], lat: 30.259, lng: -97.7355 },
  { name: 'Slice Truck', cuisine: ['pizza'], lat: 30.2695, lng: -97.7502 },
] as const

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
}

async function main() {
  for (const truck of TRUCKS) {
    const slug = slugify(truck.name)

    const owner = await db.user.upsert({
      where: { clerkId: `seed_owner_${slug}` },
      update: {},
      create: {
        clerkId: `seed_owner_${slug}`,
        email: `${slug}@seed.chomp.local`,
        role: 'operator',
        displayName: `${truck.name} Owner`,
      },
    })

    const createdTruck = await db.truck.upsert({
      where: { slug },
      update: {},
      create: {
        ownerId: owner.id,
        name: truck.name,
        slug,
        description: `${truck.name} — seeded test data.`,
        cuisineType: [...truck.cuisine],
        isVerified: true,
        isActive: true,
      },
    })

    await db.truckOperator.upsert({
      where: { truckId_userId: { truckId: createdTruck.id, userId: owner.id } },
      update: {},
      create: { truckId: createdTruck.id, userId: owner.id, role: 'owner' },
    })

    // geom is Unsupported() in Prisma — must be written via raw SQL. There's no
    // unique constraint to key an upsert on, so guard idempotency manually:
    // only insert if this truck doesn't already have a current location.
    const existingLocation = await db.truckLocation.findFirst({
      where: { truckId: createdTruck.id, isCurrent: true },
    })
    if (!existingLocation) {
      await db.$executeRaw`
        INSERT INTO truck_locations (id, truck_id, geom, address, is_current, reported_at)
        VALUES (
          gen_random_uuid(),
          ${createdTruck.id}::uuid,
          ST_MakePoint(${truck.lng}, ${truck.lat})::geography,
          ${`Somewhere near downtown Austin (${truck.name})`},
          true,
          now()
        )
      `
    }

    await db.truckSchedule.upsert({
      where: { id: `seed_schedule_${slug}` },
      update: {},
      create: {
        id: `seed_schedule_${slug}`,
        truckId: createdTruck.id,
        dayOfWeek: new Date().getDay(),
        startTime: new Date('1970-01-01T11:00:00Z'),
        endTime: new Date('1970-01-01T14:00:00Z'),
        locationNote: 'Downtown Austin',
      },
    })
  }

  console.log(`Seeded ${TRUCKS.length} trucks.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
