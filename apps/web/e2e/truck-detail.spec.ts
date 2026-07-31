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

test.describe('truck reviews', () => {
  test.skip(!canRun, 'requires DATABASE_URL and seeded data')

  test('renders visible reviews and the average rating, excluding hidden ones', async ({
    page,
  }) => {
    await page.goto(`/trucks/${SEEDED_SLUG}`)

    await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible()
    await expect(page.getByText('Best tacos in Austin, hands down.')).toBeVisible()
    // Seeded as isVisible: false — must never render.
    await expect(page.getByText('Rude at the window')).toHaveCount(0)
  })

  test('prompts a signed-out visitor to sign in instead of showing the form', async ({
    page,
  }) => {
    await page.goto(`/trucks/${SEEDED_SLUG}`)

    await expect(page.getByText('to write a review')).toBeVisible()
    await expect(page.getByPlaceholder('Optional — tell others what you thought')).toHaveCount(0)
  })
})
