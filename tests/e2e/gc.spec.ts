import { test, expect } from '@playwright/test'

test.describe('Garbage Collection', () => {
  test('page loads with title', async ({ page }) => {
    await page.goto('/gc')

    await expect(page.getByRole('heading', { name: 'Garbage Collection' })).toBeVisible()
    await expect(page.getByText('Manage OCI blob garbage collection')).toBeVisible()
  })
})
