import { test, expect } from '@playwright/test'

test.describe('Alpine APK Repository', () => {
  test('page loads with title and stats', async ({ page }) => {
    await page.goto('/alpine')

    // Verify page title exists
    await expect(page.locator('text=Alpine APK Repository').first()).toBeVisible()

    // Stats should be visible
    await expect(page.locator('text=Indexes').first()).toBeVisible()
    await expect(page.getByText('Packages', { exact: true }).first()).toBeVisible()
  })

  test('can search packages', async ({ page }) => {
    await page.goto('/alpine')

    // Use placeholder to locate search box
    await page.fill('input[placeholder="Search packages..."]', 'nginx')
    await page.press('input[placeholder="Search packages..."]', 'Enter')
    await expect(page.locator('input[placeholder="Search packages..."]')).toHaveValue('nginx')
  })
})

test.describe('Alpine Proxy API', () => {
  test('can download APKINDEX.tar.gz', async ({ request }) => {
    const response = await request.get('/alpine/v3.19/main/x86_64/APKINDEX.tar.gz')
    expect(response.ok()).toBeTruthy()
    expect(response.headers()['content-type']).toMatch(/application\/(gzip|octet-stream)/)
  })

  test('API requires authentication', async ({ request }) => {
    // Use an unauthenticated context
    const context = await request.newContext({ storageState: { cookies: [], origins: [] } })
    const response = await context.get('/api/v1/alpine/stats')
    expect(response.status()).toBe(401)
  })

  test('can access v3.23 index', async ({ request }) => {
    const response = await request.get('/alpine/v3.23/main/x86_64/APKINDEX.tar.gz')
    expect(response.ok()).toBeTruthy()
  })
})
