// Bypass: "fail three times quietly, read k off the card, restart, win with 3★".
// Uses only what the card prints (regex on its text) and the pad/stand geometry a player sees.
//   node tests/playtest2/bypass.mjs [ids]
import { open, S, run, log, closeBrowser, consoleLog, saveJson, OUT } from './lib.mjs';
import { INSTALL, cardText } from './helpers.mjs';

const ids = (process.argv[2] ?? '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17').split(',').map(Number);
const out = {};
for (const id of ids) {
  const { ctx, page } = await open(`?unlock=all&level=${id}`, { tag: `bp${id}` });
  await page.evaluate(() => window.advanceTime(16));
  await page.waitForTimeout(200);
  if (await page.isVisible('#tutGo')) await page.click('#tutGo');
  let info = await page.evaluate(INSTALL);
  const st = info[0];
  const cards = [];
  let kRead = null;
  for (let a = 1; a <= 3 && kRead === null; a++) {
    // A quiet probe: drop at 0.6 × d1 on enlargements (too small → no alarm), 1.6 × on shrinks.
    const probeK = st.k > 1 ? 0.6 : Math.min(st.k * 0.6, 0.6);
    let stand = null;
    for (const f of [1, 1.2, 0.8, 1.5]) { stand = await page.evaluate((x) => PT2.standAt(x.tid, x.d, x.p), { tid: st.tid, d: probeK * f * st.d1, p: st.stand }); if (stand) break; }
    if (!stand) { cards.push('no probe stand'); break; }
    await run(page, (s) => PT2.grab(s), st);
    await run(page, (x) => PT2.aimTarget(x.s, x.p), { s: st, p: stand });
    await run(page, () => { AP.act(); AP.tick(800); });
    const res = await run(page, () => PT2.resolve(true));
    const c = await cardText(page);
    cards.push(`${res.failure?.kind ?? res.phase}: ${c}`);
    const m = c && c.match(/היה צריך k = ([\d.]+)/);
    const mr = c && c.match(/היה צריך k בין ([\d.]+) ל־([\d.]+)/);
    if (m) kRead = +m[1];
    else if (mr) kRead = (+mr[1] + +mr[2]) / 2;
    if (await page.isVisible('#failGo')) await page.click('#failGo');
  }
  // Restart from the pause menu.
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(200);
  await page.click('#pRestart');
  await page.evaluate(() => window.advanceTime(16));
  await page.waitForTimeout(200);
  if (await page.isVisible('#tutGo')) await page.click('#tutGo');
  info = await page.evaluate(INSTALL);
  // Solve every target: the first with the k read off the card, any others with the plan (not part of the bypass).
  for (const s of info) {
    const k = s.tid === st.tid && kRead ? kRead : s.k;
    const stand = await page.evaluate((x) => PT2.standAt(x.tid, x.d, x.p), { tid: s.tid, d: k * s.d1, p: s.stand });
    await run(page, (x) => PT2.grab(x), s);
    await run(page, (x) => PT2.aimTarget(x.s, x.p), { s, p: stand ?? s.stand });
    await run(page, () => { AP.act(); AP.tick(800); });
    const res = await run(page, () => PT2.resolve(true));
    if (res.phase === 'explain') await page.click('#failGo').catch(() => {});
  }
  const WAY = { 9: [[1.5, 2.6]], 3: [[0, 1.0]] };
  await run(page, (w) => PT2.exit(w), WAY[id] ?? []);
  await page.waitForTimeout(1600);
  const f = await S(page);
  const wc = await cardText(page);
  out[id] = { kRead, cards, phase: f.phase, stars: f.stars, stats: f.stats, win: wc };
  log(`BYPASS L${id}: read k=${kRead} after ${cards.length} quiet misses -> restart -> ${f.phase} ${f.stars}★ ${JSON.stringify(f.stats)} | badges: ${(wc ?? '').match(/🎯[^🤫]*/)?.[0] ?? '-'}`);
  for (const c of cards) log('   ', c.slice(0, 220));
  await ctx.close();
}
saveJson('bypass', out);
log('console:', consoleLog.length ? consoleLog : 'none');
await closeBrowser();
