import { test, expect } from '@playwright/test'

test.describe('Go Module Proxy', () => {
  test('page loads with title', async ({ page }) => {
    await page.goto('/go')

    await expect(page.getByRole('heading', { name: 'Go Module Proxy' })).toBeVisible()
    await expect(page.getByText('Go module proxy cache statistics')).toBeVisible()

    // Proxy URL card should be visible
    await expect(page.getByText('Proxy URL')).toBeVisible()
  })
})
