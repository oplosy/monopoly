import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { createRoom, joinRoom, leaveRoom, newPlayer } from './players';

type Box = { x: number; y: number; width: number; height: number };

/** A player on an emulated touch phone. */
async function phonePlayer(browser: Browser, baseURL: string | undefined, width: number, height: number): Promise<Page> {
  const context = await browser.newContext({ baseURL, viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  return context.newPage();
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`not on screen: ${locator.toString()}`);
  return box;
}

const overlap = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/** Two boxes share no more than a sliver (anti-aliased edges). */
async function expectApart(a: Locator, b: Locator): Promise<void> {
  const [ba, bb] = [await boxOf(a), await boxOf(b)];
  expect(overlap(ba, bb), `${a.toString()} overlaps ${b.toString()}: ${JSON.stringify([ba, bb])}`).toBeLessThanOrEqual(4);
}

/** Every control is at least 44×44 CSS px, a thumb's width. */
async function expectTappable(...controls: Locator[]): Promise<void> {
  for (const control of controls) {
    // Polled: a popover pops in with a short scale, so its first frames are smaller.
    await expect
      .poll(async () => {
        const box = await boxOf(control);
        return Math.min(box.width, box.height);
      }, { message: `${control.toString()} is smaller than 44 px` })
      .toBeGreaterThanOrEqual(44);
  }
}

const tapHand = async (page: Page, card: string, option: string) => {
  await page.getByRole('list', { name: /^Your hand/ }).getByRole('button', { name: card, exact: true }).tap();
  await page.getByRole('dialog', { name: /^Play / }).getByRole('button', { name: option, exact: true }).tap();
};

test('a phone in portrait: the narrator clears the HUD, and every control fits a thumb', async ({ browser, baseURL }) => {
  const ann = await phonePlayer(browser, baseURL, 360, 740);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).tap();

  const menu = ann.getByRole('navigation', { name: 'Game menu' });
  await expectTappable(menu.getByRole('button', { name: 'Sound' }), menu.getByRole('button', { name: 'Game log' }), menu.getByRole('button', { name: 'Leave game' }));
  await expectTappable(ann.getByRole('button', { name: 'End turn' }));

  await ann.getByRole('list', { name: /^Your hand/ }).getByRole('button', { name: '2M money', exact: true }).tap();
  const popover = ann.getByRole('dialog', { name: /^Play / });
  await expectTappable(popover.getByRole('button', { name: 'Close' }), popover.getByRole('button', { name: 'Bank it (+2M)' }));
  await popover.getByRole('button', { name: 'Bank it (+2M)' }).tap();

  // The narrator tells the table what just happened, in full view.
  const narrator = ann.locator('.narrator.is-shown .narrator-text');
  await expect(narrator).toContainText('2M');
  await expectApart(narrator, menu);

  await menu.getByRole('button', { name: 'Game log' }).tap();
  await expectTappable(ann.getByRole('complementary', { name: 'Game log' }).getByRole('button', { name: 'Close' }));

  for (const page of [bob, ann]) await leaveRoom(page);
});

// A large phone (iPhone 13) and a small one (iPhone SE) on their side.
for (const [width, height] of [[844, 390], [667, 375]] as const) test(`a phone in landscape (${width}×${height}): paying keeps my table, the seats and the HUD in view`, async ({ browser, baseURL }) => {
  const ann = await phonePlayer(browser, baseURL, width, height);
  const bob = await newPlayer(browser, baseURL);
  const cy = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await joinRoom(cy, link, 'Cy');
  await expect(ann.getByRole('heading', { name: 'Players (3/3)' })).toBeVisible();
  // Seed 18 deals the hands of game.spec.ts: Ann banks 2M, then Bob's It's My Birthday makes her pay.
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).tap();
  await expectTappable(ann.getByRole('button', { name: 'End turn' }));
  await tapHand(ann, '2M money', 'Bank it (+2M)');
  await expect(ann.getByRole('group', { name: 'Your bank, 2M' })).toBeVisible();
  await ann.getByRole('button', { name: 'End turn' }).tap();
  await expect(bob.getByRole('button', { name: 'End turn' })).toBeVisible();
  await bob.getByRole('list', { name: /^Your hand/ }).getByRole('button', { name: "It's My Birthday, action, worth 2M", exact: true }).click();
  await bob.getByRole('dialog', { name: /^Play / }).getByRole('button', { name: "It's my birthday: everyone pays 2M", exact: true }).click();

  const tray = ann.getByRole('region', { name: 'You owe Bob 2M' });
  await expect(tray).toBeVisible();
  await expectTappable(tray.getByRole('button', { name: 'Pay 2M' }), tray.getByRole('button', { name: 'Auto' }));
  const menu = ann.getByRole('navigation', { name: 'Game menu' });
  // The bubble is always laid out (empty between lines), so this never waits for a line to show.
  await expectApart(ann.locator('.narrator-text'), menu);
  // The cards to pay with stay pickable: the tray never covers my area.
  const mine = ann.getByRole('region', { name: 'Your area' });
  await expectApart(tray, mine);
  await expect.poll(async () => overlap(await boxOf(mine), await boxOf(ann.getByRole('list', { name: /^Your hand/ })))).toBeLessThanOrEqual(4);
  // Neither the action in play nor the HUD hides a seat.
  const stage = ann.getByRole('region', { name: 'Action in play' });
  await expectApart(stage, menu);
  for (const seat of [/^Bob's seat/, /^Cy's seat/, /^Your seat/]) {
    await expectApart(stage, ann.getByRole('group', { name: seat }));
    await expectApart(menu, ann.getByRole('group', { name: seat }));
  }

  await tray.getByRole('button', { name: 'Pay 2M' }).tap();
  for (const page of [cy, bob, ann]) await leaveRoom(page);
});

test('a tablet in landscape: the HUD never covers the seat across the table', async ({ browser, baseURL }) => {
  const ann = await phonePlayer(browser, baseURL, 1024, 768);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.getByRole('button', { name: 'Start game' }).tap();
  await expectApart(ann.getByRole('navigation', { name: 'Game menu' }), ann.getByRole('group', { name: /^Bob's seat/ }));
  for (const page of [bob, ann]) await leaveRoom(page);
});

test('a tablet in portrait: the narrator clears the HUD', async ({ browser, baseURL }) => {
  const ann = await phonePlayer(browser, baseURL, 768, 1024);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).tap();
  await tapHand(ann, '2M money', 'Bank it (+2M)');
  const narrator = ann.locator('.narrator.is-shown .narrator-text');
  await expect(narrator).toContainText('2M');
  await expectApart(narrator, ann.getByRole('navigation', { name: 'Game menu' }));
  for (const page of [bob, ann]) await leaveRoom(page);
});
