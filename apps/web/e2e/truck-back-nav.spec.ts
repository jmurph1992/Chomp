import { test, expect } from '@playwright/test'

const SEEDED_SLUG = 'taco-kings' // from packages/db/prisma/seed.ts
const canRun = Boolean(process.env.DATABASE_URL)
const canRunWithMap = Boolean(process.env.DATABASE_URL && process.env.NEXT_PUBLIC_MAPBOX_TOKEN)

test.describe('truck detail back-nav', () => {
  test.skip(!canRun, 'requires DATABASE_URL and seeded data')

  test('arrival via Feed: back returns to Feed', async ({ page }) => {
    await page.goto('/feed')
    // Feed can seed multiple items (review + photo) linking to the same
    // truck — target by href rather than getByRole('link', { name }) to
    // avoid a strict-mode violation when more than one matches.
    await page.locator(`a[href="/trucks/${SEEDED_SLUG}"]`).first().click()
    await expect(page).toHaveURL(`/trucks/${SEEDED_SLUG}`, { timeout: 15_000 })

    await page.getByRole('button', { name: /Back/ }).click()
    await expect(page).toHaveURL('/feed', { timeout: 15_000 })
  })

  test('direct navigation: back is a fixed link to Feed, not browser history', async ({
    page,
  }) => {
    await page.goto(`/trucks/${SEEDED_SLUG}`)

    const back = page.getByRole('link', { name: /Back/ })
    await expect(back).toBeVisible()
    await expect(back).toHaveAttribute('href', '/feed')

    await back.click()
    await expect(page).toHaveURL('/feed', { timeout: 15_000 })
  })

  test.describe('arrival via Map', () => {
    test.skip(!canRunWithMap, 'requires NEXT_PUBLIC_MAPBOX_TOKEN in addition to DATABASE_URL')

    test('back returns to the map', async ({ page, context }) => {
      await context.grantPermissions(['geolocation'])
      await context.setGeolocation({ latitude: 30.2672, longitude: -97.7431 })

      await page.goto('/')
      await page.locator('.mapboxgl-marker').first().click({ timeout: 15_000 })
      await page.getByRole('link', { name: 'View truck' }).click()
      await expect(page).toHaveURL(/\/trucks\//, { timeout: 15_000 })

      await page.getByRole('button', { name: /Back/ }).click()
      await expect(page).toHaveURL('/', { timeout: 15_000 })
    })
  })
})
