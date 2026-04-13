import { test, expect } from '@playwright/test'

test.describe('PyPI', () => {
  test('page loads with title', async ({ page }) => {
    await page.goto('/pypi')

    await expect(page.getByRole('heading', { name: 'PyPI' })).toBeVisible()
    await expect(page.getByText('Python package repository')).toBeVisible()
  })
})
