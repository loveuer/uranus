import { test, expect } from '@playwright/test'

const allTabs = [
  { value: 'general', label: 'General', title: 'General Settings' },
  { value: 'npm', label: 'npm', title: 'npm Registry Settings' },
  { value: 'go', label: 'Go', title: 'Go Modules Settings' },
  { value: 'oci', label: 'OCI', title: 'OCI/Docker Registry Settings' },
  { value: 'maven', label: 'Maven', title: 'Maven Repository Settings' },
  { value: 'pypi', label: 'PyPI', title: 'PyPI Settings' },
  { value: 'alpine', label: 'Alpine', title: 'Alpine APK Settings' },
  { value: 'file', label: 'File', title: 'File Storage Settings' },
  { value: 'storage', label: 'Storage', title: 'Storage Configuration' },
]

test.describe('Settings', () => {
  test('all tabs are visible and clickable', async ({ page }) => {
    await page.goto('/settings')

    // Verify page title
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    // Click through each tab
    for (const tab of allTabs) {
      await page.getByRole('tab', { name: tab.label }).click()
      await expect(page.getByText(tab.title)).toBeVisible()
    }
  })

  test('general tab - modify settings and save', async ({ page }) => {
    await page.goto('/settings')

    // Ensure General tab is active (default)
    await page.getByRole('tab', { name: 'General' }).click()

    // Verify General settings elements
    await expect(page.getByText('General Settings')).toBeVisible()
    await expect(page.getByLabel('Server URL')).toBeVisible()
    await expect(page.getByLabel('Allow Registration')).toBeVisible()

    // Modify server_url
    const serverUrlInput = page.getByLabel('Server URL')
    await serverUrlInput.fill('http://example.com:9817')

    // Toggle allow_registration
    const allowRegSwitch = page.getByLabel('Allow Registration')
    await allowRegSwitch.check()

    // Save
    await page.getByRole('button', { name: 'Save Changes' }).click()

    // Verify save success
    await expect(page.getByText('Saved successfully')).toBeVisible()

    // Refresh and verify settings persist
    await page.reload()
    await expect(page.getByRole('tab', { name: 'General' })).toBeVisible()
    await page.getByRole('tab', { name: 'General' }).click()

    await expect(serverUrlInput).toHaveValue('http://example.com:9817')
  })

  test('npm tab - enable/disable and modify upstream', async ({ page }) => {
    await page.goto('/settings')

    // Click npm tab
    await page.getByRole('tab', { name: 'npm' }).click()

    await expect(page.getByText('npm Registry Settings')).toBeVisible()
    await expect(page.getByLabel('Enable Service')).toBeVisible()

    // Enable npm
    const enableSwitch = page.getByLabel('Enable Service')
    await enableSwitch.check()

    // After enabling, upstream should be visible
    await expect(page.getByLabel('Upstream URL')).toBeVisible()

    // Modify upstream
    const upstreamInput = page.getByLabel('Upstream URL')
    await upstreamInput.fill('https://registry.npmjs.org')

    // Save
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText('Saved successfully')).toBeVisible()

    // Disable npm
    await enableSwitch.uncheck()

    // Save
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByText('Saved successfully')).toBeVisible()

    // Refresh and verify settings persist
    await page.reload()
    await page.getByRole('tab', { name: 'npm' }).click()
    await expect(page.getByText('npm Registry Settings')).toBeVisible()
  })
})
