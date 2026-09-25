import { expect, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';

/** Each player gets their own browser context: separate storage, so a separate seat. `motion: 'off'` switches the game's animations off. */
export async function newPlayer(browser: Browser, baseURL: string | undefined, opts: { motion?: 'on' | 'off' } = {}): Promise<Page> {
  const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  if (opts.motion === 'off') await context.addInitScript(() => localStorage.setItem('dealcity.motion', 'off'));
  return context.newPage();
}

export const hand = (page: Page): Locator => page.getByRole('list', { name: /^Your hand/ });

/** Opens the game menu's settings panel (sound, animations, the log, leaving). */
export async function openSettings(page: Page): Promise<Locator> {
  const menu = page.getByRole('navigation', { name: 'Game menu' });
  const panel = menu.getByRole('group', { name: 'Settings' });
  if (!(await panel.isVisible())) await menu.getByRole('button', { name: 'Settings' }).click();
  await expect(panel).toBeVisible();
  return panel;
}

/** Opens the log drawer from the settings, waits for `text`, then closes it so it never covers the table. */
export async function expectLog(page: Page, text: string): Promise<void> {
  await (await openSettings(page)).getByRole('button', { name: 'Game log' }).click();
  const drawer = page.getByRole('complementary', { name: 'Game log' });
  await expect(drawer).toContainText(text);
  await drawer.getByRole('button', { name: 'Close' }).click();
  await expect(drawer).toHaveCount(0);
}

/** Opens a hand card's popover and picks one of its options. */
export async function playFromHand(page: Page, card: string, option: string): Promise<void> {
  await hand(page).getByRole('button', { name: card, exact: true }).click();
  await page.getByRole('dialog', { name: /^Play / }).getByRole('button', { name: option, exact: true }).click();
}

/** Attaches a screenshot to the report for visual review (not a baseline). */
export async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

/** Creates a room as `nickname` and returns the invite link. */
export async function createRoom(page: Page, nickname: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByRole('button', { name: 'Create a room' }).click();
  return page.getByLabel('Invite link').inputValue();
}

export async function joinRoom(page: Page, link: string, nickname: string): Promise<void> {
  await page.goto(link);
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByRole('button', { name: 'Join room' }).click();
}

/** Gives up this page's seat from the home page, confirming if a game is under way. */
export async function leaveRoom(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Leave that room' }).click();
  const confirm = page.getByRole('button', { name: 'Yes, leave' });
  const home = page.getByRole('button', { name: 'Create a room' });
  await expect(confirm.or(home)).toBeVisible();
  if (await confirm.isVisible()) await confirm.click();
  await expect(home).toBeVisible();
}

/** Drags `from` onto `to` with the mouse, in steps, as a player would. */
export async function dragOnto(page: Page, from: Locator, to: Locator): Promise<void> {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('dragOnto: an element is not on screen');
  // Hand cards overlap from the right: grab the left part of the card, which is never covered.
  await page.mouse.move(a.x + a.width * 0.3, a.y + a.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

/** Starts counting the flight clones this page draws from now on. */
export async function watchFlights(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { flights: number };
    w.flights = 0;
    new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement && n.classList.contains('flight')) w.flights += 1;
        });
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

/** How many flight clones this page has drawn since watchFlights. */
export async function flightsSeen(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { flights?: number }).flights ?? 0);
}
