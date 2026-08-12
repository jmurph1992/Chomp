import { test, expect } from '@playwright/test'

const canRun = Boolean(process.env.DATABASE_URL)

test.describe('public feed', () => {
  test.skip(!canRun, 'requires DATABASE_URL, seeded data, and a refreshed feed_items view')

  test('renders qualifying reviews, linked to their truck', async ({ page }) => {
    await page.goto('/feed')

    // Seeded as rating: 5, isVisible: true — qualifies (rating >= 4).
    await expect(page.getByText('Best tacos in Austin, hands down.')).toBeVisible()
    // The seeded feed can have more than one item (review + photo) linking
    // to the same truck — target by href, not getByRole('link', { name }),
    // to avoid a strict-mode violation when more than one matches.
    await expect(page.locator('a[href="/trucks/taco-kings"]').first()).toBeVisible()
  })

  test('never renders a hidden review even when its rating alone would qualify', async ({
    page,
  }) => {
    await page.goto('/feed')

    // Seeded as rating: 5 (qualifies) but isVisible: false — proves the view's
    // is_visible filter is doing real work here, not just the rating filter.
    await expect(page.getByText('Hidden for testing purposes')).toHaveCount(0)
  })

  test('also renders qualifying photos — previously always empty before photo upload existed', async ({
    page,
  }) => {
    await page.goto('/feed')

    // Seeded with 2 likes (the >= 2 threshold) on Alice's Taco Kings review.
    await expect(page.getByText('So good')).toBeVisible()
  })
})
