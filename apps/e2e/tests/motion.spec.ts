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
