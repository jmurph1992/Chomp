import { test, expect } from '@playwright/test'

const canRun = Boolean(process.env.DATABASE_URL && process.env.NEXT_PUBLIC_MAPBOX_TOKEN)

test.describe('truck map', () => {
  test.skip(!canRun, 'requires DATABASE_URL, NEXT_PUBLIC_MAPBOX_TOKEN, and seeded data')

  test('renders truck markers once geolocation is granted', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 30.2672, longitude: -97.7431 })

    await page.goto('/')

    await expect(page.locator('.mapboxgl-marker').first()).toBeVisible({ timeout: 15_000 })
  })
})
