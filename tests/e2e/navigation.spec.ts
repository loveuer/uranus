import { test, expect } from '@playwright/test'

const navItems = [
  { label: 'Files', path: '/files' },
  { label: 'npm', path: '/npm' },
  { label: 'Go', path: '/go' },
  { label: 'Docker', path: '/docker' },
  { label: 'Maven', path: '/maven' },
  { label: 'PyPI', path: '/pypi' },
  { label: 'Alpine', path: '/alpine' },
  { label: 'GC', path: '/gc' },
  { label: 'Users', path: '/users' },
  { label: 'Settings', path: '/settings' },
]

test.describe('Navigation', () => {
  test('all sidebar menu items are clickable and navigate correctly', async ({ page }) => {
    await page.goto('/files')

    for (const item of navItems) {
      // Click the nav item by its label
      const navLink = page.getByRole('link', { name: item.label })
      await expect(navLink).toBeVisible()
      await navLink.click()

      // Verify URL changed to expected path
      await expect(page).toHaveURL(new RegExp(`${item.path}`))
    }
  })

  test('active menu item is highlighted', async ({ page }) => {
    await page.goto('/files')

    // Files should be active (has bg-primary class)
    const activeFileLink = page.getByRole('link', { name: 'Files' })
    await expect(activeFileLink).toHaveClass(/bg-primary/)

    // Navigate to npm
    await page.getByRole('link', { name: 'npm' }).click()
    await expect(page).toHaveURL(/\/npm/)

    // npm should be active, Files should not
    const activeNpmLink = page.getByRole('link', { name: 'npm' })
    await expect(activeNpmLink).toHaveClass(/bg-primary/)

    const inactiveFileLink = page.getByRole('link', { name: 'Files' })
    await expect(inactiveFileLink).not.toHaveClass(/bg-primary/)
  })
})
