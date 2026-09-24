import { defineConfig } from '@playwright/test';

/** Only the smoke spec, against an already running deployment (E2E_BASE_URL). */
export default defineConfig({
  testDir: './tests',
  testMatch: /smoke\.spec\.ts/,
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://localhost:8443',
    channel: 'chrome',
    ignoreHTTPSErrors: true,
  },
});
