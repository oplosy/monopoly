import { expect, test, type Browser, type Page } from '@playwright/test';
import { createRoom, expectLog, joinRoom, leaveRoom, newPlayer } from './players';

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

/** A player whose page counts its sounds, asking for less motion or not. */
async function listener(browser: Browser, baseURL: string | undefined, reducedMotion: 'reduce' | 'no-preference'): Promise<Page> {
  const context = await browser.newContext({ baseURL, reducedMotion });
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

  const menu = ann.getByRole('navigation', { name: 'Game menu' });
  const volume = menu.getByRole('slider', { name: 'Volume' });
  // From 60 down to 30, in steps of 5, as a keyboard player would.
  for (let i = 0; i < 6; i++) await volume.press('ArrowLeft');
  await ann.reload();
  await expect(volume).toHaveValue('30');
  await expect(menu.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'true');

  await menu.getByRole('button', { name: 'Sound' }).click();
  await ann.reload();
  await expect(menu.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false');

  for (const page of [bob, ann]) await leaveRoom(page);
});

// The CC0 samples (Plan 8, Task 7) are not in the repo yet, so this listens for a synthesized tune:
// the turn chime of the player whose turn starts.
test('the next player hears their turn start, also when they ask for less motion', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL);
  const bob = await listener(browser, baseURL, 'reduce');
  const cy = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  // Clicking Join is the gesture that switches Bob's sound on.
  await joinRoom(bob, link, 'Bob');
  await joinRoom(cy, link, 'Cy');
  await expect(ann.getByRole('heading', { name: 'Players (3/3)' })).toBeVisible();

  // Seed 18 (test mode only) deals the hands of game.spec.ts; Ann moves first, then Bob.
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob, cy]) await expectLog(page, "Ann's turn");

  const before = await soundsOf(bob);
  await ann.getByRole('button', { name: 'End turn' }).click();
  await expect.poll(() => soundsOf(bob)).toBeGreaterThan(before);

  for (const page of [cy, bob, ann]) await leaveRoom(page);
});
