// Readability views for the shadow / ruler levels and a few spot checks.
import { open, run, closeBrowser, consoleLog, log, OUT } from './lib.mjs';
const VIEWS = {
  6: [['mannequin-ruler', [-1.5, 1], [-4, 0, -1.5]], ['statue-shadow-tip', [4.5, 5.5], [2.5, 0, 3]], ['statue-ruler-overview', [5.5, 6.5], [2.5, 0, -2]]],
  7: [['laser-ruler', [3, 2.5], [3, 0, -3]]],
  10: [['banner-ruler', [2, 4.5], [-3, 0.5, 0]], ['rope-overview', [4, 5], [-3, 2.5, -2]]],
  18: [['obelisk-shadow', [9.5, 9], [6.5, 0, 6]], ['tower-shadow', [-2, -10.5], [-2, 0, -6]], ['tower-up', [9, -6], [5.25, 4, -6]]],
  1: [['lightshaft', [2.5, 5], [-4.5, 3, 0]]],
};
for (const [id, views] of Object.entries(VIEWS)) {
  const { ctx, page } = await open(`?unlock=all&level=${id}`, { tag: `views${id}` });
  await page.evaluate(() => window.advanceTime(16));
  await page.waitForTimeout(200);
  if (await page.isVisible('#tutGo')) await page.click('#tutGo');
  for (const [name, at, look] of views) {
    await run(page, (a) => { AP.walkTo(a.at[0], a.at[1], 0.1); AP.aimAt(...a.look); }, { at, look });
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUT}/view-L${id}-${name}.png` });
  }
  await ctx.close();
}
log('views console:', consoleLog.length ? consoleLog : 'none');
await closeBrowser();
