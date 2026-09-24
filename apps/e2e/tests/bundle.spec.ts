import { expect, test } from '@playwright/test';

// The suite must exercise the bundle that ships, not a development build.
test('serves the production build of the app', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const script = /<script[^>]+src="([^"]+\.js)"/.exec(html)?.[1];
  expect(script).toBeDefined();
  const code = await (await request.get(script!)).text();
  // Only React's development build carries this console hint.
  expect(code.includes('Download the React DevTools'), 'the served bundle is a development build').toBe(false);
});
