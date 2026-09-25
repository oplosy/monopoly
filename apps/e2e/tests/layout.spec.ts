import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { createRoom, joinRoom, leaveRoom, newPlayer } from './players';

type Box = { x: number; y: number; width: number; height: number };

/** Spec §5.3, rendered CSS px: hand card width ≈ (±10 %), near and far table card widths (floors). */
const TARGETS = [
  { width: 1920, height: 1080, hand: 230, near: 100, far: 88 },
  { width: 1440, height: 900, hand: 190, near: 84, far: 74 },
  { width: 1280, height: 720, hand: 150, near: 70, far: 62 },
  { width: 768, height: 1024, hand: 150, near: 66, far: 58 },
  { width: 812, height: 375, hand: 86, near: 46, far: 40 },
  { width: 375, height: 812, hand: 100, near: 50, far: 44 },
] as const;

const OTHERS = ['Bob', 'Cy'] as const;

/** The measured player: a phone-sized screen is a touch phone; animations are off so nothing is mid-flight. */
async function playerAt(browser: Browser, baseURL: string | undefined, width: number, height: number): Promise<Page> {
  const phone = Math.min(width, height) <= 500;
  const context = await browser.newContext({ baseURL, viewport: { width, height }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await context.addInitScript(() => localStorage.setItem('dealcity.motion', 'off'));
  return context.newPage();
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`not on screen: ${locator.toString()}`);
  return box;
}

/**
 * A table card's rendered width: its near (bottom) edge on screen. Its box is wider off the middle of the
 * screen, where the tilt draws the card as a leaning trapezoid; two probes at its bottom corners are not.
 */
async function edgeWidth(card: Locator): Promise<number> {
  return card.evaluate((el: HTMLElement) => {
    const border = parseFloat(getComputedStyle(el).borderLeftWidth) || 0;
    const was = el.style.position;
    el.style.position = 'relative';
    const probe = (side: 'left' | 'right') => {
      const span = document.createElement('span');
      span.style.cssText = `position:absolute;${side}:${-border}px;bottom:${-border}px;width:0;height:0`;
      el.appendChild(span);
      return span;
    };
    const [a, b] = [probe('left'), probe('right')];
    const width = b.getBoundingClientRect().left - a.getBoundingClientRect().left;
    a.remove();
    b.remove();
    el.style.position = was;
    return width;
  });
}

const overlap = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

for (const t of TARGETS) {
  for (const players of [2, 3] as const) {
    test(`${t.width}×${t.height}, ${players} players: the cards meet the §5.3 targets and nothing covers the play`, async ({ browser, baseURL }) => {
      const ann = await playerAt(browser, baseURL, t.width, t.height);
      const others = await Promise.all(OTHERS.slice(0, players - 1).map(() => newPlayer(browser, baseURL, { motion: 'off' })));
      const link = await createRoom(ann, 'Ann');
      for (const [i, page] of others.entries()) await joinRoom(page, link, OTHERS[i]!);
      await ann.goto(`${link}?seed=18`);
      await ann.getByRole('button', { name: 'Start game' }).click();
      const hand = ann.getByRole('list', { name: /^Your hand/ });
      await expect(hand.getByRole('listitem')).not.toHaveCount(0);
      await ann.evaluate(() => document.fonts.ready);

      // The hand card: its own width, before the fan turns it.
      const handW = await hand.getByRole('listitem').first().getByRole('button').evaluate((el) => (el as HTMLElement).offsetWidth);
      expect(Math.abs(handW - t.hand) / t.hand, `hand card ${handW} px`).toBeLessThanOrEqual(0.1);

      // Table cards, as rendered after the tilt: the empty-bank placeholders are card-sized and never turned.
      const myCard = ann.getByRole('region', { name: 'Your area' }).locator('.bank-empty');
      const mine = await boxOf(myCard);
      const nearW = await edgeWidth(myCard);
      expect(nearW, 'my (near) table card').toBeGreaterThanOrEqual(t.near);
      for (const name of OTHERS.slice(0, players - 1)) {
        const farW = await edgeWidth(ann.getByRole('region', { name: `${name}'s area` }).locator('.bank-empty'));
        expect(farW, `${name}'s (far) table card`).toBeGreaterThanOrEqual(t.far);
        expect(farW / nearW, 'far / near').toBeGreaterThanOrEqual(0.88);
      }

      // Nothing covers the play: the hand, every tableau, the center, every seat and the HUD are apart.
      const parts: [string, Locator][] = [
        ['hand', hand],
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
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, ba] = boxes[i]!;
          const [b, bb] = boxes[j]!;
          expect(overlap(ba, bb), `${a} overlaps ${b}: ${JSON.stringify([ba, bb])}`).toBeLessThanOrEqual(4);
        }
      }
      for (const [name, box] of boxes) {
        if (name === 'hand') continue; // the hand rests partly below the screen edge by design
        expect(box.x, `${name} off the left`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${name} off the right`).toBeLessThanOrEqual(t.width);
        expect(box.y, `${name} off the top`).toBeGreaterThanOrEqual(0);
      }

      // Proportions: an avatar no taller than a table card; a HUD control at most about half a hand card.
      const cardH = Math.min(mine.height, ...(await Promise.all(OTHERS.slice(0, players - 1).map(async (n) => (await boxOf(ann.getByRole('region', { name: `${n}'s area` }).locator('.bank-empty'))).height))));
      for (const frame of await ann.locator('.seat .avatar-frame').all()) expect((await boxOf(frame)).height, 'avatar').toBeLessThanOrEqual(cardH + 1);
      for (const control of await ann.getByRole('navigation', { name: 'Game menu' }).getByRole('button').all()) {
        expect((await boxOf(control)).height, 'HUD control').toBeLessThanOrEqual(handW * 1.4 * 0.55);
      }

      for (const page of [...others, ann]) await leaveRoom(page);
    });
  }
}
