import { test, expect } from '@playwright/test'

const canRun = Boolean(process.env.DATABASE_URL && process.env.NEXT_PUBLIC_MAPBOX_TOKEN)
const SEEDED_SLUG = 'taco-kings' // from packages/db/prisma/seed.ts

test.describe('truck map', () => {
  test.skip(!canRun, 'requires DATABASE_URL, NEXT_PUBLIC_MAPBOX_TOKEN, and seeded data')

  test('renders truck markers once geolocation is granted', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 30.2672, longitude: -97.7431 })

    await page.goto('/')

    await expect(page.locator('.mapboxgl-marker').first()).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('truck detail page', () => {
  test.skip(!canRun, 'requires DATABASE_URL and seeded data')

  test('renders a seeded truck', async ({ page }) => {
    await page.goto(`/trucks/${SEEDED_SLUG}`)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('returns 404 for an unknown slug', async ({ page }) => {
    const response = await page.goto('/trucks/does-not-exist')
    expect(response?.status()).toBe(404)
  })
})
