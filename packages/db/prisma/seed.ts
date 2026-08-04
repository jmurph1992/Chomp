/**
 * Local/dev-only seed data — never run automatically. Populates a handful of
 * fake trucks around Austin, TX (matches the map's default fallback region)
 * so the map view has something to render.
 *
 * Run manually with: pnpm db:seed
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

type SeedMenuItem = {
  name: string
  description?: string
  price?: number
  dietaryFlags?: string[]
  isAvailable?: boolean
  imageUrl?: string
}
type SeedMenuCategory = { name: string; items: SeedMenuItem[] }
type SeedReviewPhoto = { url: string; caption?: string; likedBy?: string[] }
type SeedReview = {
  reviewer: string
  rating: number
  body?: string
  isVisible?: boolean
  photo?: SeedReviewPhoto
}
type SeedTruck = {
  name: string
  cuisine: string[]
  lat: number
  lng: number
  menu: SeedMenuCategory[]
  reviews: SeedReview[]
}

// Fake customers who leave reviews — distinct from truck owners.
const REVIEWERS = ['alice', 'bilal', 'carlos']

// [name, cuisine, lat, lng offset from downtown Austin, optional menu]
const TRUCKS: SeedTruck[] = [
  {
    name: 'Taco Kings',
    cuisine: ['mexican'],
    lat: 30.2672,
    lng: -97.7431,
    menu: [
      {
        name: 'Tacos',
        items: [
          {
            name: 'Al Pastor',
            description: 'Pork, pineapple, cilantro, onion',
            price: 4.5,
            dietaryFlags: ['spicy'],
            imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=200',
          },
          {
            name: 'Jackfruit Tinga',
            description: 'Smoky jackfruit, chipotle',
            price: 4.5,
            dietaryFlags: ['vegan', 'gluten-free'],
          },
          {
            name: 'Barbacoa (86\'d)',
            description: 'Sold out for the day',
            price: 5,
            isAvailable: false,
          },
        ],
      },
      {
        name: 'Drinks',
        items: [
          { name: 'Horchata', price: 3, dietaryFlags: ['vegan', 'gluten-free'] },
          { name: 'Jarritos', price: 2.5, dietaryFlags: ['vegan', 'gluten-free'] },
        ],
      },
    ],
    reviews: [
      {
        reviewer: 'alice',
        rating: 5,
        body: 'Best tacos in Austin, hands down.',
        // >= 2 likes and rating 5 — qualifies for both the review and photo
        // sides of the feed, since it was otherwise always empty (no photo
        // upload flow existed before this pass).
        photo: {
          url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400',
          caption: 'So good',
          likedBy: ['bilal', 'carlos'],
        },
      },
      { reviewer: 'bilal', rating: 2, body: 'Rude at the window', isVisible: false },
      // High-rated but hidden — proves isVisible is filtered independently of
      // rating (a rating: 2 hidden review would be excluded by rating alone).
      { reviewer: 'carlos', rating: 5, body: 'Hidden for testing purposes', isVisible: false },
    ],
  },
  {
    name: 'Pho Real',
    cuisine: ['vietnamese'],
    lat: 30.271,
    lng: -97.7375,
    menu: [
      {
        name: 'Pho',
        items: [
          { name: 'Beef Pho', price: 12, description: 'Rare steak, brisket' },
          { name: 'Tofu Pho', price: 11, dietaryFlags: ['vegan'] },
        ],
      },
    ],
    reviews: [{ reviewer: 'bilal', rating: 4, body: 'Solid broth, generous portions.' }],
  },
  {
    name: 'Waffle Wagon',
    cuisine: ['breakfast', 'dessert'],
    lat: 30.263,
    lng: -97.749,
    menu: [],
    reviews: [],
  },
  {
    name: 'Curry Up',
    cuisine: ['indian'],
    lat: 30.2755,
    lng: -97.7404,
    menu: [],
    reviews: [],
  },
  {
    name: 'Smokehouse on Wheels',
    cuisine: ['bbq'],
    lat: 30.259,
    lng: -97.7355,
    menu: [],
    reviews: [],
  },
  {
    name: 'Slice Truck',
    cuisine: ['pizza'],
    lat: 30.2695,
    lng: -97.7502,
    menu: [],
    reviews: [],
  },
]

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
}

async function main() {
  const reviewers = new Map<string, { id: string }>()
  for (const reviewer of REVIEWERS) {
    const user = await db.user.upsert({
      where: { clerkId: `seed_customer_${reviewer}` },
      update: {},
      create: {
        clerkId: `seed_customer_${reviewer}`,
        email: `${reviewer}@seed.chomp.local`,
        role: 'customer',
        displayName: reviewer[0]!.toUpperCase() + reviewer.slice(1),
      },
    })
    reviewers.set(reviewer, user)
  }

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
        verificationStatus: 'verified',
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

    for (const [categoryIndex, category] of truck.menu.entries()) {
      const categoryId = `seed_category_${slug}_${categoryIndex}`
      await db.menuCategory.upsert({
        where: { id: categoryId },
        update: {},
        create: {
          id: categoryId,
          truckId: createdTruck.id,
          name: category.name,
          displayOrder: categoryIndex,
        },
      })

      for (const [itemIndex, item] of category.items.entries()) {
        const itemId = `seed_item_${slug}_${categoryIndex}_${itemIndex}`
        await db.menuItem.upsert({
          where: { id: itemId },
          update: {},
          create: {
            id: itemId,
            categoryId,
            truckId: createdTruck.id,
            name: item.name,
            description: item.description ?? null,
            price: item.price ?? null,
            imageUrl: item.imageUrl ?? null,
            isAvailable: item.isAvailable ?? true,
            dietaryFlags: item.dietaryFlags ?? [],
          },
        })
      }
    }

    for (const review of truck.reviews) {
      const reviewer = reviewers.get(review.reviewer)
      if (!reviewer) throw new Error(`Unknown seed reviewer: ${review.reviewer}`)

      const createdReview = await db.review.upsert({
        where: { truckId_userId: { truckId: createdTruck.id, userId: reviewer.id } },
        update: {},
        create: {
          truckId: createdTruck.id,
          userId: reviewer.id,
          rating: review.rating,
          body: review.body ?? null,
          isVisible: review.isVisible ?? true,
        },
      })

      if (review.photo) {
        const photoId = `seed_photo_${slug}_${review.reviewer}`
        await db.reviewPhoto.upsert({
          where: { id: photoId },
          update: {},
          create: {
            id: photoId,
            reviewId: createdReview.id,
            userId: reviewer.id,
            truckId: createdTruck.id,
            url: review.photo.url,
            caption: review.photo.caption ?? null,
            isVisible: true,
            likesCount: review.photo.likedBy?.length ?? 0,
          },
        })

        for (const likerName of review.photo.likedBy ?? []) {
          const liker = reviewers.get(likerName)
          if (!liker) throw new Error(`Unknown seed reviewer: ${likerName}`)
          await db.photoLike.upsert({
            where: { photoId_userId: { photoId, userId: liker.id } },
            update: {},
            create: { photoId, userId: liker.id },
          })
        }
      }
    }
  }

  // Plain (non-concurrent) refresh — works whether or not the unique-index
  // migration for CONCURRENTLY refresh has been applied yet, and nothing else
  // is reading feed_items concurrently during a seed run anyway.
  await db.$executeRaw`REFRESH MATERIALIZED VIEW feed_items`

  console.log(`Seeded ${TRUCKS.length} trucks and refreshed the feed.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
