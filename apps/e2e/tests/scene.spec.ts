import { expect, test, type Browser, type Page } from '@playwright/test';
import { createRoom, joinRoom, leaveRoom, newPlayer } from './players';

/** A started game with Ann (`ann`, the host) and one or two others; returns the others' pages. */
async function startGame(browser: Browser, baseURL: string | undefined, ann: Page, players = 2): Promise<Page[]> {
  const others = [await newPlayer(browser, baseURL)];
  if (players === 3) others.push(await newPlayer(browser, baseURL));
  const link = await createRoom(ann, 'Ann');
  for (const [i, page] of others.entries()) await joinRoom(page, link, ['Bob', 'Cy'][i]!);
  await ann.getByRole('button', { name: 'Start game' }).click();
  await expect(ann.getByRole('list', { name: /^Your hand/ })).toBeVisible();
  return others;
}

const loaded = (page: Page, selector: string) =>
  expect.poll(() => page.locator(selector).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

test('the painted scene loads, and the leaves never take a click', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL);
  const wrong: string[] = [];
  ann.on('response', (r) => {
    if (r.url().includes('/scene/') && !(r.ok() && (r.headers()['content-type'] ?? '').includes('image/webp'))) wrong.push(r.url());
  });
  const [bob] = await startGame(browser, baseURL, ann);
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
  for (const page of [bob!, ann]) await leaveRoom(page);
});

test('the lobby stands on the painted meadow all the way down, with no plain green', async ({ browser, baseURL }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    const ann = await (await browser.newContext({ baseURL, viewport })).newPage();
    await createRoom(ann, 'Ann');
    const under = (x: number, y: number) =>
      ann.evaluate(([px, py]) => (document.elementFromPoint(px!, py!)?.closest('.scene-ground') ? 'meadow' : 'other'), [x, y]);
    // The bottom corners, beside the paper panel: the page's plain background showed there before.
    expect(await under(4, viewport.height - 4)).toBe('meadow');
    expect(await under(viewport.width - 4, viewport.height - 4)).toBe('meadow');
    await leaveRoom(ann);
  }
});

test('with less motion asked for, nothing in the scene moves', async ({ browser, baseURL }) => {
  const calm = await (await browser.newContext({ baseURL, reducedMotion: 'reduce' })).newPage();
  const [bob] = await startGame(browser, baseURL, calm);
  const ambient = ['sway-left', 'sway-top', 'dapple-drift', 'caustics-a', 'caustics-b', 'flap', 'flap-rest'];
  const running = (page: Page) =>
    page.evaluate(
      (names) => document.getAnimations().filter((a) => names.includes((a as CSSAnimation).animationName ?? '')).length,
      ambient,
    );
  expect(await running(calm)).toBe(0);
  // Bob asked for nothing: his scene does sway.
  await expect.poll(() => running(bob!)).toBeGreaterThan(0);
  for (const page of [bob!, calm]) await leaveRoom(page);
});

const tables = [
  ...[[1440, 900], [1280, 720], [375, 812], [390, 664], [812, 375]].map(([width, height]) => ({ players: 3, width: width!, height: height! })),
  ...[[1440, 900], [1280, 720]].map(([width, height]) => ({ players: 2, width: width!, height: height! })),
];
for (const { players, width, height } of tables) {
  test(`the leaves never lie over the play: ${players} players at ${width}×${height}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: { width, height }, reducedMotion: 'reduce' });
    const ann = await context.newPage();
    const others = await startGame(browser, baseURL, ann, players);
    for (const selector of ['.leaves-left', '.leaves-top']) await loaded(ann, selector);
    // The most opaque leaf pixel (0–255, after the CSS mask) over any tableau or the center piles, every 3 px.
    // Each zone is grown by the sway's reach (about 16 px at the branch tips), so the swaying leaves stay clear too.
    const worst = await ann.evaluate(() => {
      const SWAY = 16;
      const fade = (t: number) => Math.max(0, Math.min(1, t < 0.14 ? t / 0.14 : t > 0.86 ? (1 - t) / 0.14 : 1));
      const zones = Array.from(document.querySelectorAll('.tableau, .center-piles')).map((z) => z.getBoundingClientRect());
      let max = 0;
      for (const img of Array.from(document.querySelectorAll<HTMLImageElement>('.scene-leaves img'))) {
        const r = img.getBoundingClientRect();
        const w = Math.round(r.width);
        const h = Math.round(r.height);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const alpha = ctx.getImageData(0, 0, w, h).data;
        const vertical = img.classList.contains('leaves-left');
        for (const z of zones) {
          for (let y = z.top - SWAY; y <= z.bottom + SWAY; y += 3) {
            for (let x = z.left - SWAY; x <= z.right + SWAY; x += 3) {
              const lx = Math.floor(x - r.left);
              const ly = Math.floor(y - r.top);
              if (lx < 0 || ly < 0 || lx >= w || ly >= h) continue;
              const a = alpha[(ly * w + lx) * 4 + 3]! * fade(vertical ? ly / h : lx / w);
              max = Math.max(max, a);
            }
          }
        }
      }
      return Math.round(max);
    });
    expect(worst).toBeLessThan(64);
    for (const page of [...others, ann]) await leaveRoom(page);
  });
}
