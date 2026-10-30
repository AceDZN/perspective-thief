// Quick probe: open a level, report state, take a spawn screenshot.
import { open, S, shot, closeBrowser, consoleLog, log } from './lib.mjs';
const id = Number(process.argv[2] ?? 1);
const { ctx, page } = await open(`?unlock=all&level=${id}`, { tag: `L${id}` });
await page.waitForTimeout(800);
await page.screenshot({ path: `test-output/playtest2/probe-${id}-intro.png` });
await page.evaluate(() => window.advanceTime(16));
await page.waitForTimeout(300);
await page.screenshot({ path: `test-output/playtest2/probe-${id}-brief.png` });
log(await page.evaluate(() => document.getElementById('card')?.innerText));
await page.click('#tutGo').catch((e) => log('no tutGo', e.message));
const s = await shot(page, `probe-${id}-spawn`);
log(JSON.stringify(s).slice(0, 3000));
await ctx.close();
await closeBrowser();
log('console', consoleLog);
