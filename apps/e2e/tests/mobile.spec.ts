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

test('a phone in portrait: every control fits a thumb', async ({ browser, baseURL }) => {
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

  for (const page of [bob, ann]) await leaveRoom(page);
});

test('a phone in landscape: the pay tray fits a thumb', async ({ browser, baseURL }) => {
  const ann = await phonePlayer(browser, baseURL, 844, 390);
  const bob = await newPlayer(browser, baseURL);
  const cy = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await joinRoom(cy, link, 'Cy');
  await expect(ann.getByRole('heading', { name: 'Players (3/3)' })).toBeVisible();
  // Seed 18 deals the hands of game.spec.ts: Ann banks 2M, then Bob's It's My Birthday makes her pay.
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).tap();
  await tapHand(ann, '2M money', 'Bank it (+2M)');
  await expect(ann.getByRole('group', { name: 'Your bank, 2M' })).toBeVisible();
  await ann.getByRole('button', { name: 'End turn' }).tap();
  await expect(bob.getByRole('button', { name: 'End turn' })).toBeVisible();
  await bob.getByRole('list', { name: /^Your hand/ }).getByRole('button', { name: "It's My Birthday, action, worth 2M", exact: true }).click();
  await bob.getByRole('dialog', { name: /^Play / }).getByRole('button', { name: "It's my birthday: everyone pays 2M", exact: true }).click();

  const tray = ann.getByRole('region', { name: 'You owe Bob 2M' });
  await expect(tray).toBeVisible();
  await expectTappable(tray.getByRole('button', { name: 'Pay 2M' }), tray.getByRole('button', { name: 'Auto' }));

  await tray.getByRole('button', { name: 'Pay 2M' }).tap();
  for (const page of [cy, bob, ann]) await leaveRoom(page);
});
