import { expect, test } from '@playwright/test';
import { createRoom, joinRoom, leaveRoom, newPlayer } from './players';

test('two players chat in the lobby, and the chat carries on at the table', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL, { motion: 'off' });
  const bob = await newPlayer(browser, baseURL, { motion: 'off' });
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');

  const annLobby = ann.getByRole('region', { name: 'Chat' });
  await annLobby.getByRole('textbox', { name: 'Message' }).fill('ready?');
  await annLobby.getByRole('button', { name: 'Send' }).click();
  await expect(bob.getByRole('region', { name: 'Chat' }).getByRole('list', { name: 'Messages' })).toContainText('Ann: ready?');

  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  await expect(bob.getByRole('list', { name: /^Your hand/ })).toBeVisible();

  // At the table, a new line shows as a bubble at Ann's seat on Bob's screen, and in his sheet with the lobby's line.
  await ann.getByRole('button', { name: /^Chat/ }).click();
  const box = ann.getByRole('complementary', { name: 'Chat' }).getByRole('textbox', { name: 'Message' });
  await box.fill('good luck');
  await box.press('Enter');
  await expect(bob.getByRole('group', { name: /^Ann's seat/ })).toContainText('good luck');
  await bob.getByRole('button', { name: 'Chat, 1 unread' }).click();
  await expect(bob.getByRole('complementary', { name: 'Chat' }).getByRole('list', { name: 'Messages' })).toContainText('Ann: ready?Ann: good luck');

  for (const page of [bob, ann]) await leaveRoom(page);
});
