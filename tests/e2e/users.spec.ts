import { test, expect } from '@playwright/test'

test.describe('Users', () => {
  test('page loads with user table and create button', async ({ page }) => {
    await page.goto('/users')

    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
    await expect(page.getByText('User account management')).toBeVisible()

    // Users table should be visible
    await expect(page.getByRole('heading', { name: 'Users' }).nth(1)).toBeVisible()

    // Create User button should be visible
    await expect(page.getByRole('button', { name: 'Create User' })).toBeVisible()
  })

  test('can open create user dialog', async ({ page }) => {
    await page.goto('/users')

    await page.getByRole('button', { name: 'Create User' }).click()

    await expect(page.getByRole('heading', { name: 'Create User' })).toBeVisible()
    await expect(page.getByLabel('Username')).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByLabel('Admin Role')).toBeVisible()

    // Close dialog
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Create User' })).not.toBeVisible()
  })

  test('can open delete user dialog', async ({ page }) => {
    await page.goto('/users')

    // Wait for the user table to load (look for admin user)
    await expect(page.getByText('admin')).toBeVisible()

    // Open the actions menu for the first row
    // Use the MoreHorizontal button in the first row's actions cell
    const actionsButton = page.locator('button:has(svg)').first()
    await actionsButton.click()

    // Click delete in dropdown
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    // Confirm dialog should appear
    await expect(page.getByRole('heading', { name: 'Delete User' })).toBeVisible()
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible()

    // Cancel the deletion
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Delete User' })).not.toBeVisible()
  })
})
