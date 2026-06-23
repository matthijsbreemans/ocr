import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:14580',
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
    command: 'npm run dev',
    url: 'http://localhost:14580',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      // The suite fires well over the default 10 uploads/min limit
      UPLOAD_RATE_LIMIT: '1000',
      // The admin tests exercise the dashboard directly; bypass OIDC auth so
      // they don't get redirected to the sign-in flow.
      ADMIN_AUTH_DISABLED: 'true',
    },
  },
});
