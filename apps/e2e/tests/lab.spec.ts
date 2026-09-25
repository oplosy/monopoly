import { expect, test, type Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

async function box(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} has no box`);
  return b;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// The animation lab (Plan 12) plays a rigged table without a server; here Bob, a side seat, has the turn.
for (const size of [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`the turn wedge stays off the piles at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/lab?s=their-turn');
    await expect(page.locator('.turn-wedge')).toBeVisible();
    // Let the ring finish turning to Bob.
    await page.waitForTimeout(800);
    const wedge = await box(page, '.turn-wedge');
    expect(overlaps(wedge, await box(page, '.center-piles .deck')), 'wedge over the deck').toBe(false);
    expect(overlaps(wedge, await box(page, '.center-piles .discard')), 'wedge over the discard pile').toBe(false);
  });
}
