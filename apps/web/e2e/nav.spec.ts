import { test, expect } from '@playwright/test'

const canRun = Boolean(process.env.DATABASE_URL)

test.describe('site nav', () => {
  test.skip(!canRun, 'requires DATABASE_URL and seeded data')

  test('Home and Feed links navigate correctly', async ({ page }) => {
    await page.goto('/')

    // Generous timeout: Next dev cold-compiles a route on its first hit,
    // which can exceed the default 5s assertion timeout.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Feed' }).click()
    await expect(page).toHaveURL('/feed', { timeout: 15_000 })

    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Map' }).click()
    await expect(page).toHaveURL('/', { timeout: 15_000 })
  })

  test('marks the current page as active via aria-current', async ({ page }) => {
    await page.goto('/feed')

    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Feed' }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Map' }),
    ).not.toHaveAttribute('aria-current', 'page')
  })

  test.describe('mobile viewport', () => {
    test.use({ viewport: { width: 375, height: 667 } })

    test('shows the hamburger menu, not the inline link row', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Primary' })).not.toBeVisible()
    })

    test('opens the drawer, navigates, and closes it', async ({ page }) => {
      await page.goto('/')

      await page.getByRole('button', { name: 'Open menu' }).click()
      const drawerFeedLink = page.getByRole('dialog').getByRole('link', { name: 'Feed' })
      await expect(drawerFeedLink).toBeVisible()

      await drawerFeedLink.click()
      await expect(page).toHaveURL('/feed', { timeout: 15_000 })
      await expect(page.getByRole('dialog')).not.toBeVisible()
    })
  })

  test.describe('desktop viewport', () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('shows the inline link row, not the hamburger menu', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Open menu' })).not.toBeVisible()
    })
  })
})
