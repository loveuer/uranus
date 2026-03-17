import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:9817',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'JWT_SECRET=test-secret-12345 ../../uranus --address 0.0.0.0:9817 --data /tmp/uranus-e2e-data',
    url: 'http://localhost:9817/api/v1/alpine/stats',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
})
