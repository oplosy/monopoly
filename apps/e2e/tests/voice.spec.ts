import { expect, test } from '@playwright/test';
import { createRoom, joinRoom, leaveRoom, newPlayer } from './players';

test('two players talk: both join voice, connect, hear each other, and see the mic go off', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL, { motion: 'off' });
  const bob = await newPlayer(browser, baseURL, { motion: 'off' });
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  await expect(bob.getByRole('list', { name: /^Your hand/ })).toBeVisible();

  await ann.getByRole('button', { name: 'Join voice' }).click();
  await bob.getByRole('button', { name: 'Join voice' }).click();
  await expect(ann.getByRole('button', { name: 'Microphone' })).toHaveAttribute('aria-pressed', 'true');

  const annOnBob = bob.getByRole('group', { name: /^Ann's seat/ });
  await expect(annOnBob.getByRole('img', { name: 'In voice' })).toBeVisible();
  // Connected: the "Connecting…" tag goes, and Ann's fake beep lights her ring on Bob's screen.
  await expect(annOnBob.getByText('Connecting…')).toHaveCount(0, { timeout: 15_000 });
  await expect(annOnBob).toHaveClass(/is-talking/, { timeout: 15_000 });
  await expect(ann.getByRole('group', { name: /^Bob's seat/ })).toHaveClass(/is-talking/, { timeout: 15_000 });

  await ann.getByRole('button', { name: 'Microphone' }).click();
  await expect(annOnBob.getByRole('img', { name: 'In voice, mic off' })).toBeVisible();

  await bob.getByRole('button', { name: 'Voice options' }).click();
  await bob.getByRole('button', { name: 'Leave voice' }).click();
  await expect(ann.getByRole('group', { name: /^Bob's seat/ }).getByRole('img', { name: /In voice/ })).toHaveCount(0);

  for (const page of [bob, ann]) await leaveRoom(page);
});
