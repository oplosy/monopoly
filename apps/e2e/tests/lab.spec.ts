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

async function boxes(page: Page, selector: string): Promise<Box[]> {
  return (await page.locator(selector).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))).map(
    (r: { x: number; y: number; width: number; height: number }) => ({ x: r.x, y: r.y, width: r.width, height: r.height }),
  );
}

/** Presses one of the lab panel's buttons (the panel sits in a corner, over nothing that matters here). */
const labButton = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

const SIZES = [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
  { width: 812, height: 375 },
  { width: 568, height: 320 },
];

for (const size of SIZES) {
  test(`"Your turn" stays off the deck at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/lab?s=turn');
    await labButton(page, 'cleo: End turn');
    const pulse = page.locator('.turn-pulse');
    await expect(pulse).toBeVisible();
    // Past its pop-in, at full size.
    await page.waitForTimeout(450);
    expect(overlaps(await box(page, '.turn-pulse'), await box(page, '.center-piles .deck')), '"Your turn" over the deck').toBe(false);
  });

  test(`the action in play hides no one's table or seat at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/lab?s=rent');
    await page.getByRole('list', { name: /^Your hand/ }).getByRole('button', { name: /Birthday/ }).evaluate((el) => (el as HTMLElement).click());
    await page.getByRole('dialog', { name: /^Play / }).getByRole('button', { name: /birthday/i }).click();
    await expect(page.locator('.pending-stage')).toBeVisible();
    await page.waitForTimeout(300);
    const stage = await box(page, '.pending-stage');
    // On the smallest landscape phone the far tables touch the piles: no place is clear there, and the
    // action would rather lie over the edge of a table card than over a seat.
    const tiny = size.width < 600;
    for (const [what, selector] of [
      ...(tiny ? [] : ([['a table card', '.tableau .table-card']] as const)),
      ['a seat', '.seat'],
    ] as const) {
      for (const b of await boxes(page, selector)) expect(overlaps(stage, b), `the action in play over ${what}`).toBe(false);
    }
  });
}

test('in portrait the narrator stays off the deck and my table', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/lab?s=turn');
  await labButton(page, 'cleo: End turn');
  await expect(page.locator('.narrator.is-shown')).toBeVisible();
  const narrator = await box(page, '.narrator-text');
  expect(overlaps(narrator, await box(page, '.center-piles .deck')), 'narrator over the deck').toBe(false);
  for (const b of await boxes(page, '.tableau.is-mine .table-card, .tableau.is-mine .tableau-empty')) {
    expect(overlaps(narrator, b), 'narrator over my table').toBe(false);
  }
});
