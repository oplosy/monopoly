import { expect, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';

/** Each player gets their own browser context: separate storage, so a separate seat. */
export async function newPlayer(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  return context.newPage();
}

export const hand = (page: Page): Locator => page.getByRole('list', { name: /^Your hand/ });

/** Opens the log drawer from the HUD, waits for `text`, then closes it so it never covers the table. */
export async function expectLog(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: 'Game log' }).click();
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
