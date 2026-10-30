// L18 shadow readability: obelisk and tower shadows on their rulers, reached along the walls.
import { open, run, S, closeBrowser, log, OUT } from './lib.mjs';
const { ctx, page } = await open('?unlock=all&level=18', { tag: 'v18' });
await page.evaluate(() => window.advanceTime(16));
await page.waitForTimeout(200);
if (await page.isVisible('#tutGo')) await page.click('#tutGo');
const shots = [
  ['obelisk-from-north', [[11, 9], [11, 3.5], [8.6, 3.5]], [6.5, 0, 6]],
  ['obelisk-from-west', [[11, 3.5], [11, 9], [3.5, 9]], [6.5, 0, 6]],
  ['tower-ruler-from-south', [[3.5, 11], [-11, 11], [-11, -3.2], [-4, -3.2]], [-2, 0, -6]],
  ['tower-ruler-from-north', [[-11, -3.2], [-11, -11.3], [-1, -11.3]], [-2, 0, -6]],
];
for (const [name, path, look] of shots) {
  const st = await run(page, (a) => { for (const p of a.path) AP.walkTo(p[0], p[1], 0.1); AP.aimAt(...a.look); return { phase: AP.S().phase, guard: AP.S().guard, alarms: AP.S().stats.alarms }; }, { path, look });
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${OUT}/view18-${name}.png` });
  log(name, JSON.stringify(st));
}
await ctx.close();
await closeBrowser();
