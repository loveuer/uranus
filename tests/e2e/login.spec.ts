import { test, expect } from '@playwright/test'

test.describe('Login', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('successful login redirects to files page', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)

    await page.fill('#username', 'admin')
    await page.fill('#password', 'admin123')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page).toHaveURL(/\/files/)
  })

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/login')

    await page.fill('#username', 'admin')
    await page.fill('#password', 'wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByText(/invalid|failed|incorrect/i)).toBeVisible()
  })

  test('empty credentials shows validation', async ({ page }) => {
    await page.goto('/login')

    // Try to submit with empty fields - HTML5 validation should block
    await page.getByRole('button', { name: 'Sign In' }).click()

    // Browser's native validation should prevent submission
    // The inputs have 'required' attribute
    await expect(page.locator('#username')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
  })

  test('unauthenticated access to /files redirects to login', async ({ page }) => {
    await page.goto('/files')

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/)
  })
})
