// Level 18 in real time only (no advanceTime): is the guard posed while the player stands still,
// and after walking and stopping?
import { open, S, log, closeBrowser, OUT } from './lib.mjs';
const { ctx, page } = await open('?unlock=all&level=18', { tag: 'rt18' });
await page.waitForTimeout(4500);
if (await page.isVisible('#tutGo')) await page.click('#tutGo');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/rt18-still.png` });
// Walk forward for 1.2 s (real key events), then stop.
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/rt18-walking.png` });
await page.waitForTimeout(600);
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/rt18-stopped.png` });
log('rt18', JSON.stringify((await S(page)).guard));
await ctx.close();
await closeBrowser();
