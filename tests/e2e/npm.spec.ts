import { test, expect } from '@playwright/test'

test.describe('npm Registry', () => {
  test('page loads with title and stats', async ({ page }) => {
    await page.goto('/npm')

    await expect(page.getByRole('heading', { name: 'npm Registry' })).toBeVisible()
    await expect(page.getByText('Manage npm packages and cache')).toBeVisible()

    // Registry URL card should be visible
    await expect(page.getByText('Registry URL:')).toBeVisible()
  })
})
