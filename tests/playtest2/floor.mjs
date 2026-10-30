// Floor drops: a normal floor drop (returns to pedestal, free?), a huge floor drop (crash), and a wall drop.
import { open, S, run, log, closeBrowser, OUT } from './lib.mjs';
import { INSTALL } from './helpers.mjs';
const { ctx, page } = await open('?unlock=all&level=1', { tag: 'floor' });
await page.evaluate(() => window.advanceTime(16));
await page.waitForTimeout(200);
if (await page.isVisible('#tutGo')) await page.click('#tutGo');
const info = await page.evaluate(INSTALL);
const st = info[0];
const r = {};
await run(page, (s) => PT2.grab(s), st);
await run(page, () => { AP.walkTo(0, 1.5, 0.05); AP.aimAt(1.2, 0, -2.5); });
r.aimFloor = (await S(page)).aim;
await run(page, () => { AP.act(); AP.tick(250); });
await page.screenshot({ path: `${OUT}/floor-1-midflight.png` });
await run(page, () => AP.tick(1000));
const s1 = await S(page);
r.afterFloor = { phase: s1.phase, ex: s1.exhibits[0], stats: s1.stats, toast: await page.evaluate(() => document.getElementById('toast').innerText) };
await page.screenshot({ path: `${OUT}/floor-2-after.png` });
// Second and third floor drops: any cost?
for (let i = 0; i < 2; i++) { await run(page, (s) => PT2.grab(s), st); await run(page, () => { AP.walkTo(0, 1.5, 0.05); AP.aimAt(1.2, 0, -2.5); AP.act(); AP.tick(1200); }); }
r.after3Floor = (await S(page)).stats;
// Aim at a wall and press E.
await run(page, (s) => PT2.grab(s), st);
await run(page, () => { AP.walkTo(0, 1.5, 0.05); AP.aimAt(-5, 2, 1.5); AP.act(); AP.tick(100); });
r.wall = { aim: (await S(page)).aim, carry: (await S(page)).carry, toast: await page.evaluate(() => document.getElementById('toast').innerText) };
// Huge floor drop: aim at the far floor from far away (k large).
await run(page, () => { AP.walkTo(0, 6.5, 0.05); AP.aimAt(0, 0, -1); AP.act(); AP.tick(1500); });
const s2 = await S(page);
r.bigFloor = { phase: s2.phase, failure: s2.failure, stats: s2.stats };
await page.screenshot({ path: `${OUT}/floor-3-bigcrash.png` });
log(JSON.stringify(r, null, 1));
await ctx.close();
await closeBrowser();
