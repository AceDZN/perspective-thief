// Challenge rooms: from the map's ★ node per hall (with ?unlock=all), N rooms per world.
// Logs the generated numbers, screenshots spawn + aim + result, solves each through keyboard input.
//   node tests/playtest2/challenge.mjs [worlds] [perWorld]
import { open, S, run, log, closeBrowser, consoleLog, saveJson, OUT } from './lib.mjs';
import { INSTALL, solveCurrent, cardText } from './helpers.mjs';

const worlds = (process.argv[2] ?? '1,2,3,4').split(',').map(Number);
const per = Number(process.argv[3] ?? 4);
const out = {};
const { ctx, page } = await open('?unlock=all', { tag: 'challenge' });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/ch-menu-unlockall.png` });
for (const w of worlds) {
  out[w] = [];
  for (let i = 0; i < per; i++) {
    if ((await S(page)).mode !== 'menu') { await page.click('#winMap').catch(() => {}); await page.waitForTimeout(800); }
    await page.click(`.node.challenge[data-challenge="${w}"]`, { force: true });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.advanceTime(16));
    await page.waitForTimeout(200);
    if (await page.isVisible('#tutGo')) await page.click('#tutGo');
    const info = await page.evaluate(INSTALL);
    const s = await S(page);
    const rec = { title: s.level.title, objective: s.level.objective.replace(/[⟦⟧]/g, ''), placards: s.exhibits.map((e) => e.placard), plates: s.targets.map((t) => t.plate), plan: info.map((x) => ({ tid: x.tid, d1: x.d1, k: +x.k.toFixed(3), d2: +x.d2.toFixed(3), win: [+(x.kMin * x.d1).toFixed(3), +(x.kMax * x.d1).toFixed(3)], stand: !!x.stand })) };
    await run(page, (z) => AP.aimAt(...z), info[0].zone);
    await page.screenshot({ path: `${OUT}/ch-w${w}-${i}-spawn.png` });
    const r = await solveCurrent(page, `ch-w${w}-${i}`, { shots: true });
    rec.result = { phase: r.phase, stars: r.stars, steps: r.steps };
    out[w].push(rec);
    log(`CH W${w}#${i}: ${rec.title} | ${rec.objective} | ex: ${rec.placards.join(' / ')} | t: ${rec.plates.join(' / ')} | ${JSON.stringify(rec.plan)} -> ${r.phase} ${r.stars}★`);
  }
}
saveJson('challenge', out);
log('console:', consoleLog.length ? consoleLog : 'none');
await ctx.close();
await closeBrowser();
