import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --mode test --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_API_MODE: 'mock',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
