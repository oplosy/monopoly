import { expect, test } from '@playwright/test';
import { attachScreenshot, createRoom, expectLog, hand, joinRoom, leaveRoom, newPlayer, playFromHand } from './players';

test('three players play a seeded game through to a rematch', async ({ browser, baseURL }, testInfo) => {
  const [ann, bob, cy] = [await newPlayer(browser, baseURL), await newPlayer(browser, baseURL), await newPlayer(browser, baseURL)];

  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await joinRoom(cy, link, 'Cy');
  await expect(ann.getByRole('heading', { name: 'Players (3/3)' })).toBeVisible();

  // Seed 18 (honoured only in test mode) deals the hands in the plan's table; Ann moves first.
  // Loading the seeded address is also a reload, so the host's seat must resume.
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob, cy]) await expectLog(page, "Ann's turn");

  // Ann: a property, a bank deposit, end of turn.
  await playFromHand(ann, 'Gull Street, Sky property, worth 1M', 'Play as a Sky property');
  await expect(bob.getByRole('region', { name: "Ann's area" }).getByRole('group', { name: 'Sky group, 1 of 3' })).toBeVisible();
  await attachScreenshot(bob, testInfo, 'table-3p');
  await playFromHand(ann, '2M money', 'Bank it (+2M)');
  await expect(ann.getByRole('group', { name: 'Your bank, 2M' })).toBeVisible();
  await ann.getByRole('button', { name: 'End turn' }).click();

  // Bob: bank 1M, then It's My Birthday; Ann pays from her bank on the table, Cy has nothing to pay.
  await expectLog(bob, "Bob's turn");
  await playFromHand(bob, '1M money', 'Bank it (+1M)');
  await playFromHand(bob, "It's My Birthday, action, worth 2M", "It's my birthday: everyone pays 2M");
  await ann.getByRole('region', { name: 'You owe Bob 2M' }).getByRole('button', { name: 'Pay 2M' }).click();
  await expectLog(bob, 'Ann paid Bob 2M');
  await expect(bob.getByRole('group', { name: 'Your bank, 3M' })).toBeVisible();
  await bob.getByRole('button', { name: 'End turn' }).click();

  // Cy: a reload mid-turn keeps the seat and the hand.
  await expectLog(cy, "Cy's turn");
  await cy.reload();
  await expect(hand(cy).getByRole('button')).toHaveCount(7);
  await playFromHand(cy, '4M money', 'Bank it (+4M)');
  await cy.getByRole('button', { name: 'End turn' }).click();
  await expect(ann.getByRole('button', { name: 'End turn' })).toBeVisible();

  // Bob and Cy leave; the last player standing wins, and the host starts a rematch.
  for (const page of [bob, cy]) await leaveRoom(page);
  const over = ann.getByRole('dialog', { name: 'You win!' });
  await expect(over).toBeVisible();
  await over.getByRole('button', { name: 'Play again' }).click();
  await expect(ann.getByRole('heading', { name: 'Players (1/3)' })).toBeVisible();
});
