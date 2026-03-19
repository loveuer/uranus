import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import * as path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const testResultsDir = path.join(__dirname, '..', 'test-results')
fs.mkdirSync(testResultsDir, { recursive: true })

test.describe('UI Visual Regression Tests', () => {
  test('Login page - visual check', async ({ page }) => {
    await page.goto('/login')
    await page.waitForTimeout(2000)

    const loginCard = await page.locator('.MuiPaper-root').first()
    await expect(loginCard).toBeVisible()

    await page.screenshot({ path: path.join(testResultsDir, 'login.png'), fullPage: true })
  })

  test('Files page - visual check', async ({ page }) => {
    await page.goto('/login')
    await page.waitForSelector('input[name="username"]', { timeout: 10000 })
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/files/, { timeout: 15000 })
    await page.waitForTimeout(2000)

    const dataGrid = await page.locator('.MuiDataGrid-root')
    await expect(dataGrid).toBeVisible()

    await page.screenshot({ path: path.join(testResultsDir, 'files.png'), fullPage: true })
  })

  test('Navigation - sidebar and appbar visual check', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/files/, { timeout: 15000 })

    const appBar = await page.locator('.MuiAppBar-root')
    await expect(appBar).toBeVisible()

    const drawer = await page.locator('.MuiDrawer-root')
    await expect(drawer).toBeVisible()

    await page.screenshot({ path: path.join(testResultsDir, 'navigation.png'), fullPage: true })
  })
})
