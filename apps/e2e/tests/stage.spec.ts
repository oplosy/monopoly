import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { FELT, STAGE } from '../../web/src/scene/felt';
import { createRoom, joinRoom, leaveRoom, newPlayer, openSettings } from './players';

// The table screen is one 1920×1080 stage over the backdrop video, scaled whole to the window
// (spec 2026-09-26-video-stage). These check it at desktop sizes and on a phone on its side.

type Box = { x: number; y: number; width: number; height: number };

const OTHERS = ['Bob', 'Cy'] as const;

/** The measured player: a small screen is a touch phone; animations are off so nothing is mid-flight. */
async function playerAt(browser: Browser, baseURL: string | undefined, width: number, height: number, motion: 'on' | 'off' = 'off'): Promise<Page> {
  const phone = Math.min(width, height) <= 500;
  const context = await browser.newContext({ baseURL, viewport: { width, height }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  if (motion === 'off') await context.addInitScript(() => localStorage.setItem('dealcity.motion', 'off'));
  return context.newPage();
}

/** Ann at `width`×`height` starts seed 18's game with `players` players; the others are plain desktop players. */
async function startGame(browser: Browser, baseURL: string | undefined, width: number, height: number, players: 2 | 3) {
  const ann = await playerAt(browser, baseURL, width, height);
  const others = await Promise.all(OTHERS.slice(0, players - 1).map(() => newPlayer(browser, baseURL, { motion: 'off' })));
  const link = await createRoom(ann, 'Ann');
  for (const [i, page] of others.entries()) await joinRoom(page, link, OTHERS[i]!);
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  await expect(handCards(ann)).not.toHaveCount(0);
  await ann.evaluate(() => document.fonts.ready);
  return { ann, others, all: [...others, ann] };
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
  let boxes = '';
  await expect
    .poll(async () => {
      const [ba, bb] = [await boxOf(a), await boxOf(b)];
      boxes = JSON.stringify([ba, bb]);
      return overlap(ba, bb);
    }, { message: `${a.toString()} overlaps ${b.toString()}` })
    .toBeLessThanOrEqual(4)
    .catch((e: Error) => {
      throw new Error(`${e.message}
boxes: ${boxes}`);
    });
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

const handCards = (page: Page): Locator => page.getByRole('list', { name: /^Your hand/ }).getByRole('listitem');

/** The stage's box on the screen and its scale. */
async function stageOf(page: Page): Promise<Box & { scale: number }> {
  const box = await boxOf(page.locator('.stage'));
  return { ...box, scale: box.width / STAGE.w };
}

/** Every corner of every box matching `selector`, in stage px, that lies off the felt. */
async function offFelt(page: Page, selector: string): Promise<string[]> {
  return page.evaluate(
    ({ selector, felt, w }) => {
      const s = document.querySelector('.stage')!.getBoundingClientRect();
      const k = s.width / w;
      const on = (x: number, y: number) => Math.abs((x - felt.cx) / felt.rx) ** felt.n + Math.abs((y - felt.cy) / felt.ry) ** felt.n <= 1;
      const off: string[] = [];
      for (const el of Array.from(document.querySelectorAll(selector))) {
        const r = el.getBoundingClientRect();
        for (const [x, y] of [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]] as const) {
          const [sx, sy] = [(x - s.left) / k, (y - s.top) / k];
          if (!on(sx, sy)) off.push(`${el.className} at ${Math.round(sx)},${Math.round(sy)}`);
        }
      }
      return off;
    },
    { selector, felt: FELT, w: STAGE.w },
  );
}

/**
 * Presses my hand card `name` on its uncovered left strip, as a thumb would: the next card covers the rest.
 * The point is found in the card's own turned frame, like a finger on a fan.
 */
async function pressHand(page: Page, name: string, how: 'tap' | 'click' = 'click'): Promise<void> {
  const card = page.getByRole('list', { name: /^Your hand/ }).getByRole('button', { name, exact: true });
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
    // The card's turn in the fan, and its drawn size (the stage's scale): its box is both.
    const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el.parentElement!).transform);
    const [a = 1, b = 0] = m ? m[1]!.split(',').map(Number) : [];
    const turn = Math.atan2(b, a);
    const c = Math.abs(Math.cos(turn));
    const s = Math.abs(Math.sin(turn));
    const w = (r.width * c - r.height * s) / (c * c - s * s);
    const h = (r.height * c - r.width * s) / (c * c - s * s);
    // Low enough on the card that its hover (it straightens a little) keeps it under the finger.
    const dx = (0.22 - 0.5) * w;
    const dy = (0.55 - 0.5) * h;
    return { x: r.left + r.width / 2 + dx * Math.cos(turn) - dy * Math.sin(turn), y: r.top + r.height / 2 + dx * Math.sin(turn) + dy * Math.cos(turn) };
  });
  if (how === 'tap') await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
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

// The user's three screens, a common laptop, and a phone on its side.
const SIZES = [
  [1920, 1080],
  [1366, 768],
  [2560, 1440],
  [1280, 800],
  [844, 390],
] as const;

for (const [width, height] of SIZES) {
  for (const players of [2, 3] as const) {
    test(`${width}×${height}, ${players} players: the stage fits whole, the table's things lie on the felt and the seats beside it`, async ({ browser, baseURL }) => {
      const { ann, all } = await startGame(browser, baseURL, width, height, players);
      const stage = await stageOf(ann);
      // Scaled whole, centered, the rest letterbox.
      expect(stage.scale).toBeCloseTo(Math.min(width / STAGE.w, height / STAGE.h), 3);
      expect(stage.x).toBeCloseTo((width - stage.width) / 2, 0);
      expect(stage.y).toBeCloseTo((height - stage.height) / 2, 0);
      // Animations are off here: the backdrop holds still on its poster.
      await expect(ann.locator('.stage video.stage-video')).toHaveAttribute('poster', '/bg_poster.jpg');

      // Everything that lies on the table lies on the felt.
      const onTable = '.tableau .table-card, .tableau-empty, .bank-empty, .center-piles .deck, .center-piles .discard, .turn-ring, .bank-total, .count-badge';
      expect(await ann.locator(onTable).count()).toBeGreaterThan(players * 2);
      expect(await offFelt(ann, onTable)).toEqual([]);

      // The seats stand beside the table, on the floor, inside the stage.
      for (const seat of await ann.locator('.seat').all()) {
        const b = await boxOf(seat);
        const cx = (b.x + b.width / 2 - stage.x) / stage.scale;
        expect(Math.abs(cx - FELT.cx), 'a seat beside the table').toBeGreaterThan(FELT.rx);
        expect(b.x).toBeGreaterThanOrEqual(stage.x - 1);
        expect(b.x + b.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
      }

      // The cards: my hand card at its stage size, never tiny on a desktop.
      const handW = (await boxOf(handCards(ann).first().getByRole('button'))).width;
      if (width >= 1280) expect(handW, 'hand card').toBeGreaterThanOrEqual(140);
      const bankW = (await boxOf(ann.getByRole('region', { name: 'Your area' }).locator('.bank-empty'))).width;
      if (width >= 1280) expect(bankW, 'table card').toBeGreaterThanOrEqual(60);

      // Nothing covers the play: the hand, every tableau, the center, every seat and the HUD are apart.
      const parts: [string, Locator][] = [
        ['hand', ann.getByRole('list', { name: /^Your hand/ })],
        ['my area', ann.getByRole('region', { name: 'Your area' })],
        ['center', ann.getByRole('region', { name: 'Table center' })],
        ['my seat', ann.getByRole('group', { name: /^Your seat/ })],
        ['HUD', ann.getByRole('navigation', { name: 'Game menu' })],
        ...OTHERS.slice(0, players - 1).flatMap((name): [string, Locator][] => [
          [`${name}'s area`, ann.getByRole('region', { name: `${name}'s area` })],
          [`${name}'s seat`, ann.getByRole('group', { name: new RegExp(`^${name}'s seat`) })],
        ]),
      ];
      const boxes = await Promise.all(parts.map(async ([name, l]) => [name, await boxOf(l)] as const));
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, ba] = boxes[i]!;
          const [b, bb] = boxes[j]!;
          expect(overlap(ba, bb), `${a} overlaps ${b}: ${JSON.stringify([ba, bb])}`).toBeLessThanOrEqual(4);
        }

      // The settings button keeps the stage's top right corner.
      const gear = await boxOf(ann.getByRole('navigation', { name: 'Game menu' }).getByRole('button', { name: 'Settings' }));
      expect(stage.x + stage.width - (gear.x + gear.width)).toBeLessThanOrEqual(24);
      expect(gear.y - stage.y).toBeLessThanOrEqual(24);

      for (const page of all) await leaveRoom(page);
    });
  }
}

test('?calib=1 draws the felt in red and moves it, and the table with it, from the keyboard', async ({ browser, baseURL }) => {
  const { ann, all } = await startGame(browser, baseURL, 1920, 1080, 2);
  const url = new URL(ann.url());
  url.searchParams.set('calib', '1');
  const logs: string[] = [];
  ann.on('console', (m) => logs.push(m.text()));
  await ann.goto(url.toString());
  const panel = ann.getByRole('complementary', { name: 'Felt calibration' });
  await expect(panel).toContainText(`cx${FELT.cx}`);
  await expect(ann.locator('.felt-outline path')).toHaveAttribute('stroke', 'red');
  const before = await boxOf(ann.getByRole('region', { name: 'Table center' }));
  await ann.keyboard.press('Shift+ArrowRight');
  await expect(panel).toContainText(`cx${FELT.cx + 10}`);
  const after = await boxOf(ann.getByRole('region', { name: 'Table center' }));
  expect(after.x - before.x).toBeCloseTo(10, 0);
  await ann.keyboard.press('Alt+ArrowUp');
  await expect(panel).toContainText(`ry${FELT.ry + 1}`);
  expect(logs.some((l) => l.includes(`cx: ${FELT.cx + 10}`) && l.includes(`ry: ${FELT.ry + 1}`))).toBe(true);
  for (const page of all) await leaveRoom(page);
});

test('with animations on, the backdrop video plays', async ({ browser, baseURL }) => {
  const ann = await playerAt(browser, baseURL, 1920, 1080, 'on');
  const bob = await newPlayer(browser, baseURL, { motion: 'off' });
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.getByRole('button', { name: 'Start game' }).click();
  const video = ann.locator('.stage video.stage-video');
  await expect(video).toHaveAttribute('src', '/bg_loop.mp4');
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0)).toBe(true);
  for (const page of [bob, ann]) await leaveRoom(page);
});

test('a portrait phone letterboxes the stage and says how to see it bigger', async ({ browser, baseURL }) => {
  const { ann, all } = await startGame(browser, baseURL, 390, 844, 2);
  const stage = await stageOf(ann);
  expect(stage.width).toBeCloseTo(390, 0);
  expect(stage.y).toBeGreaterThan(200);
  await expect(ann.getByText('Turn your phone sideways for bigger cards.')).toBeVisible();
  for (const page of all) await leaveRoom(page);
});

for (const [width, height] of [[1366, 768], [844, 390]] as const) test(`${width}×${height}: paying keeps my table, the seats and the HUD in view`, async ({ browser, baseURL }) => {
  const { ann, others, all } = await startGame(browser, baseURL, width, height, 2);
  const tray = await birthdayForTwo(ann, others[0]!, () => expectClear(ann.getByRole('region', { name: 'Your area' }), handCards(ann)));
  const menu = ann.getByRole('navigation', { name: 'Game menu' });
  const mine = ann.getByRole('region', { name: 'Your area' });
  await expectApart(tray, mine);
  await expectApart(ann.locator('.narrator-text'), menu);
  const stage = ann.getByRole('region', { name: 'Action in play' });
  for (const seat of [/^Bob's seat/, /^Your seat/]) {
    await expectApart(stage, ann.getByRole('group', { name: seat }));
    await expectApart(menu, ann.getByRole('group', { name: seat }));
    await expectApart(tray, ann.getByRole('group', { name: seat }));
  }
  await expectApart(stage, menu);
  await tray.getByRole('button', { name: 'Pay 2M' }).click();
  for (const page of all) await leaveRoom(page);
});

for (const [width, height] of [[1920, 1080], [1366, 768], [844, 390]] as const) test(`${width}×${height}: the discard tray keeps my seat, my table and my hand in view`, async ({ browser, baseURL }) => {
  const { ann, all } = await startGame(browser, baseURL, width, height, 2);
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
  await pressHand(ann, '4M money');
  await discard.getByRole('button', { name: 'Discard 1/1' }).click();
  await expect(discard).toHaveCount(0);
  for (const page of all) await leaveRoom(page);
});

for (const [width, height] of [[1920, 1080], [1366, 768], [2560, 1440], [844, 390]] as const) test(`${width}×${height}: End turn is round, big, beside my hand and clear of my things`, async ({ browser, baseURL }) => {
  const { ann, all } = await startGame(browser, baseURL, width, height, 2);
  const end = ann.getByRole('button', { name: 'End turn' });
  await expect(end).toHaveAccessibleDescription(/^Turn ends in \d+s$/);
  const box = await boxOf(end);
  const stage = await stageOf(ann);
  expect(Math.min(box.width, box.height), 'End turn is big').toBeGreaterThanOrEqual(Math.max(44, 130 * stage.scale));
  expect(Math.abs(box.width - box.height), 'End turn is round').toBeLessThanOrEqual(1);
  await expectApart(end, ann.getByRole('group', { name: /^Your seat/ }));
  await expectApart(end, ann.getByRole('region', { name: 'Your area' }));
  await expectClear(end, handCards(ann));
  for (const page of all) await leaveRoom(page);
});

test('a phone on its side: every control of the UI layer fits a thumb, and a tap on the table closes the menu', async ({ browser, baseURL }) => {
  const { ann, all } = await startGame(browser, baseURL, 844, 390, 2);
  const settings = await openSettings(ann);
  for (const control of [...['Sound', 'Animations', 'Game log', 'Leave game'].map((name) => settings.getByRole('button', { name })), ann.getByRole('button', { name: 'End turn' })]) {
    const b = await boxOf(control);
    expect(Math.min(b.width, b.height), control.toString()).toBeGreaterThanOrEqual(44);
  }
  await ann.getByRole('region', { name: 'Table center' }).tap();
  await expect(settings).toBeHidden();
  for (const page of all) await leaveRoom(page);
});
