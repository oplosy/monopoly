import { expect, test, type Browser, type Page } from '@playwright/test';
import { createRoom, joinRoom, leaveRoom, newPlayer } from './players';

/** Two players at a started game; `ann` hosts, and Bob's page is returned. */
async function startGame(browser: Browser, baseURL: string | undefined, ann: Page): Promise<Page> {
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.getByRole('button', { name: 'Start game' }).click();
  await expect(ann.getByRole('list', { name: /^Your hand/ })).toBeVisible();
  return bob;
}

const loaded = (page: Page, selector: string) =>
  expect.poll(() => page.locator(selector).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

test('the painted scene loads, and the leaves never take a click', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL);
  const wrong: string[] = [];
  ann.on('response', (r) => {
    if (r.url().includes('/scene/') && !(r.ok() && (r.headers()['content-type'] ?? '').includes('image/webp'))) wrong.push(r.url());
  });
  const bob = await startGame(browser, baseURL, ann);
  for (const selector of ['.plate-art', '.leaves-left', '.leaves-top', '.table-art']) await loaded(ann, selector);
  expect(wrong).toEqual([]);

  // What a click at a point would reach: the painted layers must never be it.
  const hitAt = (x: number, y: number) =>
    ann.evaluate(([px, py]) => {
      const hit = document.elementFromPoint(px!, py!);
      if (hit?.closest('.scene-leaves')) return 'leaves';
      if (hit?.closest('.scene-ground')) return 'ground';
      return hit?.closest('.center-piles') ? 'center piles' : 'other';
    }, [x, y]);
  const center = (await ann.locator('.center-piles').boundingBox())!;
  expect(await hitAt(center.x + center.width / 2, center.y + center.height / 2)).toBe('center piles');
  const leaves = (await ann.locator('.leaves-left').boundingBox())!;
  expect(await hitAt(leaves.x + leaves.width * 0.3, leaves.y + leaves.height * 0.5)).not.toBe('leaves');
  for (const page of [bob, ann]) await leaveRoom(page);
});

test('with less motion asked for, nothing in the scene moves', async ({ browser, baseURL }) => {
  const calm = await (await browser.newContext({ baseURL, reducedMotion: 'reduce' })).newPage();
  const bob = await startGame(browser, baseURL, calm);
  const ambient = ['sway-left', 'sway-top', 'dapple-drift', 'caustics-a', 'caustics-b', 'flap', 'flap-rest'];
  const running = (page: Page) =>
    page.evaluate(
      (names) => document.getAnimations().filter((a) => names.includes((a as CSSAnimation).animationName ?? '')).length,
      ambient,
    );
  expect(await running(calm)).toBe(0);
  // Bob asked for nothing: his scene does sway.
  await expect.poll(() => running(bob)).toBeGreaterThan(0);
  for (const page of [bob, calm]) await leaveRoom(page);
});

for (const size of [{ width: 1440, height: 900 }, { width: 375, height: 812 }, { width: 812, height: 375 }]) {
  test(`the leaves never lie over the play at ${size.width}×${size.height}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: size, reducedMotion: 'reduce' });
    const ann = await context.newPage();
    const bob = await startGame(browser, baseURL, ann);
    for (const selector of ['.leaves-left', '.leaves-top']) await loaded(ann, selector);
    // The most opaque leaf pixel over any tableau or the center piles (0–255), read from the drawn leaves.
    const worst = await ann.evaluate(() => {
      const zones = Array.from(document.querySelectorAll('.tableau, .center-piles')).map((z) => z.getBoundingClientRect());
      let max = 0;
      for (const img of Array.from(document.querySelectorAll<HTMLImageElement>('.scene-leaves img'))) {
        const r = img.getBoundingClientRect();
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(r.width);
        canvas.height = Math.round(r.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        for (const z of zones) {
          for (let fx = 0; fx <= 1; fx += 0.25) {
            for (let fy = 0; fy <= 1; fy += 0.25) {
              const x = z.left + z.width * fx - r.left;
              const y = z.top + z.height * fy - r.top;
              if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
              max = Math.max(max, ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3]!);
            }
          }
        }
      }
      return max;
    });
    expect(worst).toBeLessThan(80);
    for (const page of [bob, ann]) await leaveRoom(page);
  });
}
