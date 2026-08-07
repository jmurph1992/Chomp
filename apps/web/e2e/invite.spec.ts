import { test, expect } from '@playwright/test'

// Same gate as dashboard.spec.ts — this only proves middleware's public-route
// allowlist change, not the full create->claim round trip (which needs two
// distinct authenticated Clerk identities, a gap already acknowledged
// elsewhere for review submission and truck creation).
const canRun = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

test.describe('invite claim page access', () => {
  test.skip(!canRun, 'requires NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to be configured')

  test('a signed-out visitor can load the invite page without being bounced to sign-in', async ({
    page,
  }) => {
    await page.goto('/invite/some-token')
    await expect(page).not.toHaveURL(/sign-in/)
  })
})
