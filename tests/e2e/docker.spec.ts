import { test, expect } from '@playwright/test'

test.describe('Docker/OCI', () => {
  test('page loads with title and repos section', async ({ page }) => {
    await page.goto('/docker')

    await expect(page.getByRole('heading', { name: 'Docker' })).toBeVisible()
    await expect(page.getByText('OCI container image repository')).toBeVisible()

    // Repos list area should be visible
    await expect(page.getByRole('heading', { name: 'Repositories' })).toBeVisible()
  })
})
