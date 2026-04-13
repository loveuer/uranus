import { test, expect } from '@playwright/test'

test.describe('Maven', () => {
  test('page loads with title', async ({ page }) => {
    await page.goto('/maven')

    await expect(page.getByRole('heading', { name: 'Maven' })).toBeVisible()
    await expect(page.getByText('Java artifact repository')).toBeVisible()
  })
})
