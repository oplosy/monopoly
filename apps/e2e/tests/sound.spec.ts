import { expect, test, type Browser, type Page } from '@playwright/test';
import { createRoom, expectLog, joinRoom, leaveRoom, newPlayer, openSettings, playFromHand } from './players';

/** Counts every sound a page starts (samples and tunes) in window.sounds, before the page's own scripts run. */
function countSounds() {
  const w = window as unknown as { sounds: number };
  w.sounds = 0;
  const protos: { start: (this: AudioScheduledSourceNode, ...args: number[]) => void }[] = [AudioBufferSourceNode.prototype, OscillatorNode.prototype];
  for (const proto of protos) {
    const start = proto.start;
    proto.start = function (this: AudioScheduledSourceNode, ...args: number[]) {
      w.sounds += 1;
      return start.apply(this, args);
    };
  }
}

/** A player whose page counts its sounds, with the game's animations on or off. */
async function listener(browser: Browser, baseURL: string | undefined, motion: 'on' | 'off'): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  if (motion === 'off') await context.addInitScript(() => localStorage.setItem('dealcity.motion', 'off'));
  await context.addInitScript(countSounds);
  return context.newPage();
}

const soundsOf = (page: Page) => page.evaluate(() => (window as unknown as { sounds: number }).sounds);

test('the sound toggle and the volume are remembered across a reload', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.getByRole('button', { name: 'Start game' }).click();

  const settings = await openSettings(ann);
  const volume = settings.getByRole('slider', { name: 'Volume' });
  // From 60 down to 30, in steps of 5, as a keyboard player would.
  for (let i = 0; i < 6; i++) await volume.press('ArrowLeft');
  await ann.reload();
  await openSettings(ann);
  await expect(volume).toHaveValue('30');
  await expect(settings.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'true');

  await settings.getByRole('button', { name: 'Sound' }).click();
  await ann.reload();
  await openSettings(ann);
  await expect(settings.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false');

  for (const page of [bob, ann]) await leaveRoom(page);
});

test('the other players hear a card being banked, also with animations switched off', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL);
  const bob = await listener(browser, baseURL, 'off');
  const cy = await listener(browser, baseURL, 'on');
  const link = await createRoom(ann, 'Ann');
  // Clicking Join is the gesture that switches their sound on.
  await joinRoom(bob, link, 'Bob');
  await joinRoom(cy, link, 'Cy');
  await expect(ann.getByRole('heading', { name: 'Players (3/3)' })).toBeVisible();

  // Seed 18 (test mode only) deals the hands of game.spec.ts; Ann moves first.
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob, cy]) await expectLog(page, "Ann's turn");

  const [bobBefore, cyBefore] = [await soundsOf(bob), await soundsOf(cy)];
  await playFromHand(ann, '2M money', 'Bank it (+2M)');
  await expect.poll(() => soundsOf(bob)).toBeGreaterThan(bobBefore);
  await expect.poll(() => soundsOf(cy)).toBeGreaterThan(cyBefore);

  for (const page of [cy, bob, ann]) await leaveRoom(page);
});
