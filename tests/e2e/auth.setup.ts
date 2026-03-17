import { test as setup, expect } from '@playwright/test'

const authFile = 'e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // 登录
  await page.goto('/login')
  await page.fill('input[name="username"]', 'admin')
  await page.fill('input[name="password"]', 'admin123')
  await page.click('button[type="submit"]')

  // 等待登录成功（跳转到首页）
  await expect(page).toHaveURL(/\/files/)

  // 保存认证状态
  await page.context().storageState({ path: authFile })
})
