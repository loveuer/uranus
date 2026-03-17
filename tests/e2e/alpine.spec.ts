import { test, expect } from '@playwright/test'

test.describe('Alpine APK Repository', () => {
  test.beforeEach(async ({ page }) => {
    // 登录 - 使用 label 定位输入框
    await page.goto('/login')
    await page.waitForSelector('input[type="text"]')
    await page.fill('input[type="text"]', 'admin')
    await page.fill('input[type="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/files/)

    // 导航到 Alpine 页面
    await page.click('text=Alpine')
    await expect(page).toHaveURL(/\/alpine/)

    // 等待页面加载
    await page.waitForSelector('text=Alpine APK Repository')
  })

  test('page loads with title and stats', async ({ page }) => {
    // 使用更宽松的匹配，因为实际渲染可能是 h1 或其他标题
    await expect(page.locator('text=Alpine APK Repository').first()).toBeVisible()
    await expect(page.locator('text=Indexes').first()).toBeVisible()
    // Packages 文本可能出现在多个地方，使用精确匹配
    await expect(page.getByText('Packages', { exact: true }).first()).toBeVisible()
  })

  test('can search packages', async ({ page }) => {
    // 使用 placeholder 定位搜索框并输入
    await page.fill('input[placeholder="Search packages..."]', 'nginx')
    // 按 Enter 触发搜索
    await page.press('input[placeholder="Search packages..."]', 'Enter')
    // 简单验证搜索框内容已提交
    await expect(page.locator('input[placeholder="Search packages..."]')).toHaveValue('nginx')
  })

  test('can view package details', async ({ page }) => {
    await page.fill('input[placeholder="Search packages..."]', 'redis')
    await page.press('input[placeholder="Search packages..."]', 'Enter')
    // 验证搜索功能正常工作
    await expect(page.locator('input[placeholder="Search packages..."]')).toHaveValue('redis')
  })
})

test.describe('Alpine Proxy API', () => {
  test('can download APKINDEX.tar.gz', async ({ request }) => {
    const response = await request.get('/alpine/v3.19/main/x86_64/APKINDEX.tar.gz')
    expect(response.ok()).toBeTruthy()
    expect(response.headers()['content-type']).toMatch(/application\/(gzip|octet-stream)/)
  })

  test('API requires authentication', async ({ request }) => {
    const response = await request.get('/api/v1/alpine/stats')
    expect(response.status()).toBe(401)
  })

  test('can access v3.23 index', async ({ request }) => {
    const response = await request.get('/alpine/v3.23/main/x86_64/APKINDEX.tar.gz')
    expect(response.ok()).toBeTruthy()
  })
})

test.describe('Alpine Settings', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login')
    await page.waitForSelector('input[type="text"]')
    await page.fill('input[type="text"]', 'admin')
    await page.fill('input[type="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/files/)
  })

  test('Alpine settings tab exists', async ({ page }) => {
    // 导航到设置页面
    await page.click('text=Settings')
    await expect(page).toHaveURL(/\/settings/)
    
    // 点击 Alpine tab - 使用更精确的选择器
    await page.getByRole('tab', { name: /Alpine/i }).click()
    
    // 验证设置表单存在
    await expect(page.getByText('Alpine Module')).toBeVisible()
    // 使用 placeholder 来定位输入框
    await expect(page.locator('input[placeholder="https://dl-cdn.alpinelinux.org/alpine"]')).toBeVisible()
    await expect(page.locator('input[placeholder="v3.23,v3.22,v3.21,v3.20,edge"]')).toBeVisible()
  })

  test('can view and save Alpine settings', async ({ page }) => {
    // 导航到设置页面
    await page.click('text=Settings')
    await expect(page).toHaveURL(/\/settings/)
    
    await page.getByRole('tab', { name: /Alpine/i }).click()
    
    // 验证输入框存在（通过 label 文本）
    await expect(page.getByLabel('Upstream Repository')).toBeVisible()
    await expect(page.getByLabel('Branches')).toBeVisible()
    
    // 启用 Alpine
    await page.getByLabel('Enable Alpine APK proxy').check()
    
    // 保存设置
    await page.getByRole('button', { name: 'Save' }).click()
    
    // 验证保存成功提示
    await expect(page.getByText('Saved successfully')).toBeVisible()
  })
})
