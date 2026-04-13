import { test, expect } from '@playwright/test'

test.describe('File Store', () => {
  test('page loads with title and stats', async ({ page }) => {
    await page.goto('/files')

    // Verify page title
    await expect(page.getByRole('heading', { name: 'File Store' })).toBeVisible()
    await expect(page.getByText('Manage file uploads and downloads')).toBeVisible()

    // Verify stats badge is visible
    await expect(page.getByText(/files/)).toBeVisible()
  })

  test('upload button is visible', async ({ page }) => {
    await page.goto('/files')

    await expect(page.getByRole('button', { name: 'Upload' })).toBeVisible()
  })
})
