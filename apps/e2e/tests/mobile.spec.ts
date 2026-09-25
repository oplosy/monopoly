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

const handCards = (page: Page): Locator => page.getByRole('list', { name: /^Your hand/ }).getByRole('listitem');

/**
 * Presses my hand card `name` on its uncovered left strip, as a thumb would: the next card covers the rest
 * (spec §5.5: at least 28 % shows). The point is found in the card's own turned frame, like a finger on a fan.
 */
async function pressHand(page: Page, name: string, how: 'tap' | 'click' = 'click'): Promise<void> {
  const card = page.getByRole('list', { name: /^Your hand/ }).getByRole('button', { name, exact: true });
  // Wait as .tap() would: the card is shown, enabled (no scene playing) and at rest.
  await expect(card).toBeVisible();
  await expect(card).not.toHaveAttribute('aria-disabled');
  await expect.poll(async () => {
    const a = await boxOf(card);
    await page.waitForTimeout(50);
    const b = await boxOf(card);
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }).toBeLessThan(0.5);
  const at = await card.evaluate((el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el.parentElement!).transform);
    const [a = 1, b = 0] = m ? m[1]!.split(',').map(Number) : [];
    const turn = Math.atan2(b, a);
    const scale = Math.hypot(a, b) || 1;
    const dx = (0.12 - 0.5) * el.offsetWidth * scale;
    const dy = (0.15 - 0.5) * el.offsetHeight * scale; // near the top, by the corner value: a landscape hand shows only its top half
    return { x: r.left + r.width / 2 + dx * Math.cos(turn) - dy * Math.sin(turn), y: r.top + r.height / 2 + dx * Math.sin(turn) + dy * Math.cos(turn) };
  });
  if (how === 'tap') await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}

/** `a` shares no more than a sliver with any of `others` (polled: the table settles after a move). */
async function expectClear(a: Locator, others: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const box = await boxOf(a);
      const worst = await Promise.all((await others.all()).map(async (o) => overlap(box, await boxOf(o))));
      return Math.max(0, ...worst);
    }, { message: `${a.toString()} overlaps ${others.toString()}` })
    .toBeLessThanOrEqual(4);
}

/** Every box stays on screen, top to bottom. */
async function expectOnScreen(page: Page, ...items: Locator[]): Promise<void> {
  const height = page.viewportSize()!.height;
  for (const item of items) {
    const box = await boxOf(item);
    expect(box.y, `${item.toString()} runs off the top`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${item.toString()} runs off the bottom`).toBeLessThanOrEqual(height);
  }
}

/** Seed 18 with 2 players: Ann banks 2M (then `banked` runs) and ends her turn; Bob's It's My Birthday makes her pay. */
async function birthdayForTwo(ann: Page, bob: Page, banked?: () => Promise<void>): Promise<Locator> {
  await pressHand(ann, '2M money');
  await ann.getByRole('dialog', { name: /^Play / }).getByRole('button', { name: 'Bank it (+2M)', exact: true }).click();
  await expect(ann.getByRole('group', { name: 'Your bank, 2M' })).toBeVisible();
  await banked?.();
  await ann.getByRole('button', { name: 'End turn' }).click();
  await expect(bob.getByRole('button', { name: 'End turn' })).toBeVisible();
  await bob.getByRole('list', { name: /^Your hand/ }).getByRole('button', { name: "It's My Birthday, action, worth 2M", exact: true }).click();
  await bob.getByRole('dialog', { name: /^Play / }).getByRole('button', { name: "It's my birthday: everyone pays 2M", exact: true }).click();
  const tray = ann.getByRole('region', { name: 'You owe Bob 2M' });
  await expect(tray).toBeVisible();
  return tray;
}

const tapHand = async (page: Page, card: string, option: string) => {
  await pressHand(page, card, 'tap');
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

  await pressHand(ann, '2M money', 'tap');
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
  // My table stays clear of my resting hand.
  await expectClear(ann.getByRole('region', { name: 'Your area' }), handCards(ann));
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

// With 2 players the far seat sits at the top middle of a round table.
for (const [width, height] of [[844, 390], [568, 320]] as const) test(`a phone in landscape (${width}×${height}), 2 players: the far seat stays on screen and my table clear of my hand`, async ({ browser, baseURL }) => {
  const ann = await phonePlayer(browser, baseURL, width, height);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).tap();
  const bobSeat = ann.getByRole('group', { name: /^Bob's seat/ });
  const mySeat = ann.getByRole('group', { name: /^Your seat/ });
  await expectOnScreen(ann, bobSeat, mySeat);
  await expectClear(mySeat, handCards(ann));
  // My table clears my resting hand; paying tucks the hand away.
  const tray = await birthdayForTwo(ann, bob, () => expectClear(ann.getByRole('region', { name: 'Your area' }), handCards(ann)));
  await expectApart(ann.getByRole('region', { name: 'Action in play' }), bobSeat);
  await tray.getByRole('button', { name: 'Pay 2M' }).tap();
  for (const page of [bob, ann]) await leaveRoom(page);
});

const player = (browser: Browser, baseURL: string | undefined, width: number, height: number): Promise<Page> =>
  width <= 700 ? phonePlayer(browser, baseURL, width, height) : browser.newContext({ baseURL, viewport: { width, height } }).then((c) => c.newPage());

// Laptop screens (16:9) and phones, down to the shortest: the discard tray waits clear of my seat, my
// table and my hand, and the table it lifts keeps the far seat clear of the HUD.
for (const [width, height] of [[1280, 720], [1366, 768], [360, 740], [375, 667], [360, 640], [320, 568], [844, 390], [568, 320]] as const) test(`${width}×${height}: the discard tray keeps my seat and my table in view`, async ({ browser, baseURL }) => {
  const ann = await player(browser, baseURL, width, height);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  // Payday alone: 8 cards at the end of the turn, one over the limit.
  await pressHand(ann, 'Payday, action, worth 1M');
  await ann.getByRole('dialog', { name: /^Play / }).getByRole('button', { name: 'Payday: draw 2 cards', exact: true }).click();
  await expect(handCards(ann)).toHaveCount(8);
  await ann.getByRole('button', { name: 'End turn' }).click();
  const discard = ann.getByRole('region', { name: 'Discard 1 card' });
  await expect(discard).toBeVisible();
  await expectApart(discard, ann.getByRole('group', { name: /^Your seat/ }));
  await expectApart(discard, ann.getByRole('region', { name: 'Your area' }));
  await expectClear(discard, handCards(ann));
  const menu = ann.getByRole('navigation', { name: 'Game menu' });
  await expectApart(menu, ann.getByRole('group', { name: /^Bob's seat/ }));
  await expectApart(menu, discard);
  // In portrait the HUD is one row; landscape phones stand it as a column in the corner.
  if (width < height) await expect.poll(async () => (await boxOf(menu)).height, { message: 'the HUD wraps to a second row' }).toBeLessThan(60);
  await pressHand(ann, '4M money');
  await discard.getByRole('button', { name: 'Discard 1/1' }).click();
  await expect(discard).toHaveCount(0);
  for (const page of [bob, ann]) await leaveRoom(page);
});

// With 2 players Bob sits at the top middle, where the action in play stands: it never hides him.
for (const [width, height] of [[1280, 720], [390, 844]] as const) test(`${width}×${height}, 2 players: the action in play keeps the far seat in view`, async ({ browser, baseURL }) => {
  const ann = await player(browser, baseURL, width, height);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  const tray = await birthdayForTwo(ann, bob);
  const stage = ann.getByRole('region', { name: 'Action in play' });
  await expectApart(stage, ann.getByRole('group', { name: /^Bob's seat/ }));
  await expectApart(tray, ann.getByRole('region', { name: 'Your area' }));
  await tray.getByRole('button', { name: 'Pay 2M' }).click();
  for (const page of [bob, ann]) await leaveRoom(page);
});
