import { test, expect } from '@playwright/test'

const canRun = Boolean(process.env.DATABASE_URL)
const SEEDED_SLUG = 'taco-kings' // from packages/db/prisma/seed.ts

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

test.describe('truck menu', () => {
  test.skip(!canRun, 'requires DATABASE_URL and seeded data')

  test('renders menu items grouped by category, excluding unavailable items', async ({ page }) => {
    await page.goto(`/trucks/${SEEDED_SLUG}`)

    await expect(page.getByRole('heading', { name: 'Menu' })).toBeVisible()
    await expect(page.getByText('Al Pastor')).toBeVisible()
    // Seeded as isAvailable: false — must never render.
    await expect(page.getByText("Barbacoa (86'd)")).toHaveCount(0)
  })

  test('narrows items when a dietary filter chip is selected', async ({ page }) => {
    await page.goto(`/trucks/${SEEDED_SLUG}`)

    await expect(page.getByText('Al Pastor')).toBeVisible()

    await page.getByRole('button', { name: 'vegan', exact: true }).click()

    await expect(page.getByText('Jackfruit Tinga')).toBeVisible()
    // "Al Pastor" is seeded with only the "spicy" flag, not "vegan".
    await expect(page.getByText('Al Pastor')).toHaveCount(0)
  })
})
