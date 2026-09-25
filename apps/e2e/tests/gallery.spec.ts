import { expect, test } from '@playwright/test';

test('the card sheet shows every card', async ({ page }, testInfo) => {
  await page.goto('/gallery');
  await expect(page.getByRole('heading', { name: 'Deal City card sheet' })).toBeVisible();
  // 106 cards, the back, 4 wildcard orientations and 12 characters.
  await expect(page.locator('figure')).toHaveCount(123);
  await page.evaluate(() => document.fonts.ready);
  const path = testInfo.outputPath('gallery.png');
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach('gallery', { path, contentType: 'image/png' });
});
