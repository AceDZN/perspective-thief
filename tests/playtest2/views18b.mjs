// Close look at the L18 obelisk and its ruler (is the 2 m shadow on the ruler?).
import { open, run, closeBrowser, log, OUT } from './lib.mjs';
const { ctx, page } = await open('?unlock=all&level=18', { tag: 'v18b' });
await page.evaluate(() => window.advanceTime(16));
await page.waitForTimeout(200);
if (await page.isVisible('#tutGo')) await page.click('#tutGo');
for (const [name, path, look] of [
  ['obelisk-close', [[11, 9], [11, 8.2], [7, 8.2]], [7, 0, 6]],
  ['obelisk-close2', [[7, 8.2], [5, 7.5]], [7.2, 0, 6]],
  ['tower-base', [[5, 7.5], [11, 8], [11, -3.6], [4, -3.6]], [3, 0, -6]],
]) {
  const st = await run(page, (a) => { for (const p of a.path) AP.walkTo(p[0], p[1], 0.1); AP.aimAt(...a.look); return AP.S().stats.alarms; }, { path, look });
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${OUT}/view18-${name}.png` });
  log(name, 'alarms', st);
}
await ctx.close();
await closeBrowser();
