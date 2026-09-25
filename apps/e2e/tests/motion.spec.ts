import { expect, test } from '@playwright/test';
import {
  attachScreenshot, createRoom, dragOnto, expectLog, flightsSeen, hand, joinRoom, leaveRoom, newPlayer, playFromHand, watchFlights,
} from './players';

// This spec is about the flights: the OS does not ask for less motion.
test.use({ reducedMotion: 'no-preference' });

test('cards fly across the table, and a card dragged onto the bank is banked', async ({ browser, baseURL }, testInfo) => {
  const [ann, bob, cy] = [await newPlayer(browser, baseURL), await newPlayer(browser, baseURL), await newPlayer(browser, baseURL)];
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await joinRoom(cy, link, 'Cy');
  await expect(ann.getByRole('heading', { name: 'Players (3/3)' })).toBeVisible();

  // Seed 18 (test mode only) deals the hands of game.spec.ts; Ann moves first.
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob, cy]) await expectLog(page, "Ann's turn");
  await watchFlights(bob);

  // Ann drags her 2M onto her bank; Bob watches it fly there, and the table settles.
  await dragOnto(ann, hand(ann).getByRole('button', { name: '2M money', exact: true }), ann.getByRole('group', { name: 'Your bank, 0M' }));
  await expect(ann.getByRole('group', { name: 'Your bank, 2M' })).toBeVisible();
  await expect.poll(() => flightsSeen(bob)).toBeGreaterThan(0);
  await expect(bob.locator('.flight')).toHaveCount(0);
  await expect(bob.getByRole('region', { name: "Ann's area" }).getByRole('button', { name: '2M money', exact: true })).toBeVisible();

  // Ann plays a property from the popover; Cy's table is captured mid-flight and after landing, for review.
  await playFromHand(ann, 'Gull Street, Sky property, worth 1M', 'Play as a Sky property');
  await attachScreenshot(cy, testInfo, 'flight-mid');
  await expect(cy.getByRole('region', { name: "Ann's area" }).getByRole('group', { name: 'Sky group, 1 of 3' })).toBeVisible();
  await expect(cy.locator('.flight')).toHaveCount(0);
  await attachScreenshot(cy, testInfo, 'flight-landed');

  for (const page of [cy, bob, ann]) await leaveRoom(page);
});

test('cards fly even when the OS asks for less motion, and the Animations switch turns them off for good', async ({ browser, baseURL }) => {
  const calmOs = { baseURL, reducedMotion: 'reduce' as const };
  const ann = await (await browser.newContext(calmOs)).newPage();
  const bob = await (await browser.newContext(calmOs)).newPage();
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob]) {
    await expect(hand(page).getByRole('button')).not.toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
    await watchFlights(page);
  }
  const [first, second] = (await ann.getByRole('button', { name: 'End turn' }).isVisible()) ? [ann, bob] : [bob, ann];
  await first.getByRole('button', { name: 'End turn' }).click();
  await expect.poll(() => flightsSeen(second)).toBeGreaterThan(0);

  // The waiting player switches animations off; it survives a reload.
  const menu = first.getByRole('navigation', { name: 'Game menu' });
  await menu.getByRole('button', { name: 'Animations' }).click();
  await first.reload();
  await expect(menu.getByRole('button', { name: 'Animations' })).toHaveAttribute('aria-pressed', 'false');
  await expect(first.locator('html')).toHaveAttribute('data-motion', 'off');
  await watchFlights(first);
  await expect(second.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
  await second.getByRole('button', { name: 'End turn' }).click();
  await expect(first.getByRole('button', { name: 'End turn' })).toBeVisible();
  expect(await flightsSeen(first)).toBe(0);

  for (const page of [bob, ann]) await leaveRoom(page);
});

test('every page carries the motion setting from the first paint', async ({ page }) => {
  for (const path of ['/', '/gallery']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
  }
});

test('a dragged card stays under the pointer where it was grabbed', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.getByRole('button', { name: 'Start game' }).click();
  await expect(hand(ann).getByRole('button')).not.toHaveCount(0);
  const mover = (await ann.getByRole('button', { name: 'End turn' }).isVisible()) ? ann : bob;
  await expect(mover.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
  const card = hand(mover).getByRole('button').first();
  const rest = (await card.boundingBox())!;
  const grab = { x: rest.x + rest.width * 0.3, y: rest.y + rest.height * 0.3 };
  await mover.mouse.move(grab.x, grab.y);
  await mover.waitForTimeout(250); // the hover lift settles
  const lifted = (await card.boundingBox())!;
  const f = { x: (grab.x - lifted.x) / lifted.width, y: (grab.y - lifted.y) / lifted.height };
  await mover.mouse.down();
  const to = { x: grab.x + 160, y: grab.y - 240 };
  await mover.mouse.move(to.x, to.y, { steps: 12 });
  await mover.waitForTimeout(300); // the lean settles back to upright
  const ghost = (await mover.locator('.drag-ghost').boundingBox())!;
  expect(Math.abs(ghost.x + f.x * ghost.width - to.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(ghost.y + f.y * ghost.height - to.y)).toBeLessThanOrEqual(2);
  await mover.mouse.up();
  for (const page of [bob, ann]) await leaveRoom(page);
});

test('a card dropped while it leans flies from where it leans, with no snap upright', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  // Seed 18 (test mode only): Ann moves first, holding "2M money".
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  const mover = ann;
  await expect(mover.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
  // Every flight's first frame, and the dragged card's own turn, frame by frame, until it is gone.
  await mover.evaluate(() => {
    const w = window as unknown as { starts: number[]; ghostTurn: number | null };
    w.starts = [];
    w.ghostTurn = null;
    const turn = (t: string) => {
      const r = /rotate\(([-\d.]+)deg\)/.exec(t);
      if (r) return Number(r[1]);
      const m = /matrix\(([^)]+)\)/.exec(t);
      if (!m) return 0;
      const [a, b] = m[1]!.split(',').map(Number);
      return (Math.atan2(b!, a!) * 180) / Math.PI;
    };
    const watch = () => {
      const ghost = document.querySelector('.drag-ghost');
      if (ghost) w.ghostTurn = turn(getComputedStyle(ghost).transform);
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, opts) {
      if (this.classList.contains('flight') && Array.isArray(frames)) w.starts.push(turn(String(frames[0]!.transform)));
      return animate.call(this, frames, opts);
    };
  });
  const money = hand(mover).getByRole('button', { name: '2M money', exact: true });
  const bank = mover.getByRole('group', { name: /^Your bank/ });
  const a = (await money.boundingBox())!;
  const b = (await bank.boundingBox())!;
  await mover.mouse.move(a.x + a.width * 0.3, a.y + a.height * 0.3);
  await mover.mouse.down();
  // A first small step on the card starts the drag (and captures the pointer).
  await mover.mouse.move(a.x + a.width * 0.3 + 10, a.y + a.height * 0.3 - 10);
  // A quick sideways sweep onto the bank: the card leans with its speed, and is released mid-sweep.
  const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  for (let i = 10; i >= 0; i--) {
    await mover.mouse.move(end.x - i * 30, end.y);
    await mover.waitForTimeout(12);
  }
  await mover.mouse.up();
  await expect(bank).toHaveAccessibleName(/[1-9]\d*M$/);
  const { starts, ghostTurn } = await mover.evaluate(() => {
    const w = window as unknown as { starts: number[]; ghostTurn: number | null };
    return { starts: w.starts, ghostTurn: w.ghostTurn };
  });
  // The card was leaning as it was let go, and its flight starts at that same turn.
  expect(Math.abs(ghostTurn!)).toBeGreaterThan(1);
  expect(starts).toHaveLength(1);
  expect(Math.abs(starts[0]! - ghostTurn!)).toBeLessThanOrEqual(1);
  for (const page of [bob, ann]) await leaveRoom(page);
});

test('a card dropped nowhere flies home and lands exactly on its place in the hand', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  // Seed 18 (test mode only): Ann moves first, holding "2M money".
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  await expect(ann.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
  const money = hand(ann).getByRole('button', { name: '2M money', exact: true });
  const id = await money.getAttribute('data-card');
  // Frame by frame: the ghost's card and the resting card, with their turns.
  await ann.evaluate((cardId) => {
    const w = window as unknown as { frames: { ghost: number[] | null; card: number[]; shown: boolean }[] };
    w.frames = [];
    const turn = (el: Element | null) => {
      const m = el ? /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform) : null;
      if (!m) return 0;
      const [a, b] = m[1]!.split(',').map(Number);
      return (Math.atan2(b!, a!) * 180) / Math.PI;
    };
    const tick = () => {
      const ghost = document.querySelector('.drag-ghost');
      const card = document.querySelector(`.hand-fan [data-card="${cardId}"]`)!;
      const g = ghost?.firstElementChild?.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      w.frames.push({
        ghost: g ? [g.left + g.width / 2, g.top + g.height / 2, turn(ghost)] : null,
        card: [c.left + c.width / 2, c.top + c.height / 2, turn(card.parentElement)],
        shown: getComputedStyle(card).visibility !== 'hidden',
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, id);
  const box = (await money.boundingBox())!;
  await ann.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await ann.mouse.down();
  await ann.mouse.move(box.x + box.width * 0.3 + 12, box.y + box.height * 0.3 - 12);
  // Up into the corner above the HUD's left, off every drop zone, and let go there.
  await ann.mouse.move(20, 20, { steps: 10 });
  await ann.mouse.up();
  await expect(ann.locator('.drag-ghost')).toHaveCount(0);
  const frames = await ann.evaluate(() => (window as unknown as { frames: { ghost: number[] | null; card: number[]; shown: boolean }[] }).frames);
  const last = frames.map((f) => !!f.ghost).lastIndexOf(true);
  const [gx, gy, gturn] = frames[last]!.ghost!;
  const [cx, cy, cturn] = frames[last]!.card;
  // In its last frame the ghost lies on the resting card, turned like it; the next frame shows the card itself.
  expect(Math.hypot(gx! - cx!, gy! - cy!)).toBeLessThanOrEqual(2);
  expect(Math.abs(gturn! - cturn!)).toBeLessThanOrEqual(1);
  expect(frames[last]!.shown).toBe(false);
  expect(frames[last + 1]!.shown).toBe(true);
  for (const page of [bob, ann]) await leaveRoom(page);
});
