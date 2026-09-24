import { expect, test } from '@playwright/test';
import { createRoom, hand, joinRoom, newPlayer } from './players';

test('two players can meet and start a game', async ({ browser, baseURL, request }) => {
  expect((await request.get('/healthz')).ok()).toBe(true);
  const ann = await newPlayer(browser, baseURL);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  // The link is a deep link: the server must answer it with the app.
  await joinRoom(bob, link, 'Bob');
  await expect(ann.getByRole('heading', { name: 'Players (2/3)' })).toBeVisible();
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob]) {
    await expect(page.getByRole('region', { name: 'Your area' })).toBeVisible();
    await expect(hand(page).getByRole('button')).not.toHaveCount(0);
  }
});
