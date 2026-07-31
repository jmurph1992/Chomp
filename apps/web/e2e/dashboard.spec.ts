import { test, expect } from '@playwright/test'

// Doesn't need seed data or DATABASE_URL — this only exercises middleware's
// auth requirement, which needs a real Clerk instance to redirect through.
const canRun = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

test.describe('operator dashboard access', () => {
  test.skip(!canRun, 'requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to be configured')

  test('redirects a signed-out visitor to sign-in instead of showing the dashboard', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/sign-in/)
  })

  test('redirects a signed-out visitor away from a specific truck dashboard too', async ({
    page,
  }) => {
    await page.goto('/dashboard/some-truck-id')
    await expect(page).toHaveURL(/sign-in/)
  })
})
