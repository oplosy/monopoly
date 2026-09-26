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
    // Voice chat: a fake microphone (a beeping tone), the permission prompt answered yes, and audio allowed to play.
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    },
  },
  webServer: {
    command: 'node serve-test.mjs',
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NODE_ENV: 'test', PORT: String(PORT), TURN_MS: '600000', RESPONSE_MS: '300000' },
  },
});
