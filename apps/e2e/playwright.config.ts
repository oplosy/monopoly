import { defineConfig } from '@playwright/test';

const PORT = 3100;

/** Runs every spec against a fresh, built server in test mode (seeds allowed, long timers). */
export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm --filter @deal-city/web build && pnpm --filter @deal-city/server build && node ../server/dist/main.js',
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NODE_ENV: 'test', PORT: String(PORT), TURN_MS: '600000', RESPONSE_MS: '300000' },
  },
});
