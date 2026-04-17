// playwright.config.js
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'webkit',   use: devices['Desktop Safari'] },
  ],
  reporter: 'list',
});
