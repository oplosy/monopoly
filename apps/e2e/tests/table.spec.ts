import { expect, test } from '@playwright/test';
import { attachScreenshot, createRoom, flightsSeen, hand, joinRoom, leaveRoom, newPlayer, watchFlights } from './players';

// The table must work with the OS asking for less motion.
test.use({ reducedMotion: 'reduce' });

test('two players pick characters and meet at the picnic table', async ({ browser, baseURL }, testInfo) => {
  const ann = await newPlayer(browser, baseURL);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await expect(ann.getByRole('heading', { name: 'Players (2/3)' })).toBeVisible();

  // Ann takes the Owl (the defaults for p1 and p2 are the Duck and the Mouse); Bob sees it taken at once.
  await ann.getByRole('button', { name: 'Owl', exact: true }).click();
  await expect(ann.getByRole('button', { name: 'Owl', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(bob.getByRole('button', { name: 'Owl, taken by Ann' })).toBeDisabled();
  await attachScreenshot(ann, testInfo, 'lobby');

  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob]) {
    await expect(hand(page).getByRole('button')).not.toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Table center' })).toBeVisible();
    await expect(page.getByRole('group', { name: /^Your seat/ })).toBeVisible();
  }
  await expect(bob.getByRole('group', { name: /^Ann's seat/ })).toBeVisible();

  // Any hand card opens its popover on the card (it explains itself when it is not playable); Escape closes it.
  await hand(ann).getByRole('button').first().click();
  await expect(ann.getByRole('dialog', { name: /^Play / })).toBeVisible();
  await ann.keyboard.press('Escape');
  await expect(ann.getByRole('dialog')).toHaveCount(0);
  await attachScreenshot(ann, testInfo, 'table-2p');

  for (const page of [bob, ann]) await leaveRoom(page);
});

test('nothing flies when the OS asks for less motion', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob]) {
    await expect(hand(page).getByRole('button')).not.toHaveCount(0);
    await watchFlights(page);
  }

  // Whoever moves first ends the turn: the other player draws, and every card simply appears.
  const [first, second] = (await ann.getByRole('button', { name: 'End turn' }).isVisible()) ? [ann, bob] : [bob, ann];
  await first.getByRole('button', { name: 'End turn' }).click();
  await expect(second.getByRole('button', { name: 'End turn' })).toBeVisible();
  await expect(second.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
  expect(await flightsSeen(ann)).toBe(0);
  expect(await flightsSeen(bob)).toBe(0);

  for (const page of [bob, ann]) await leaveRoom(page);
});
