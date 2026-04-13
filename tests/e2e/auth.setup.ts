import { test as setup, expect } from '@playwright/test'

const authFile = '.auth/user.json'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.fill('#username', 'admin')
  await page.fill('#password', 'admin123')
  await page.getByRole('button', { name: 'Sign In' }).click()

  // Wait for login success and redirect
  await expect(page).toHaveURL(/\/files/)

  // Save authentication state
  await page.context().storageState({ path: authFile })
})
