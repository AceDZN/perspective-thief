// Chase fairness: on each level, one too-big drop (k × 1.25 from the solver's standing direction),
// then run straight for the nearest sarcophagus the moment the alarm starts. Records whether the
// player makes it, the distances at the alarm, and the stars after finishing the level.
//   node tests/playtest2/chase.mjs [ids]
import { open, S, run, log, closeBrowser, consoleLog, saveJson, OUT } from './lib.mjs';
import { INSTALL, solveCurrent } from './helpers.mjs';

const ids = (process.argv[2] ?? '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17').split(',').map(Number);
const out = {};
for (const id of ids) {
  const { ctx, page } = await open(`?unlock=all&level=${id}`, { tag: `chase${id}` });
  await page.evaluate(() => window.advanceTime(16));
  await page.waitForTimeout(200);
  if (await page.isVisible('#tutGo')) await page.click('#tutGo');
  const info = await page.evaluate(INSTALL);
  const st = info[0];
  let k = st.k * 1.25, stand = null;
  for (const f of [1.25, 1.15, 1.4, 1.1]) { k = st.k * f; stand = await page.evaluate((a) => PT2.standAt(a.tid, a.d, a.p), { tid: st.tid, d: k * st.d1, p: st.stand }); if (stand) break; }
  await run(page, (s) => PT2.grab(s), st);
  await run(page, (a) => PT2.aimTarget(a.s, a.p), { s: st, p: stand });
  await run(page, () => { AP.act(); });
  // Wait for the alarm.
  const r = await run(page, () => {
    for (let i = 0; i < 60 && AP.S().phase !== 'chase' && AP.S().phase !== 'explain'; i++) AP.tick(50);
    const s = AP.S();
    const p = s.player, g = s.guard.pos;
    const h = [...s.hides].sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.z) - Math.hypot(b[0] - p.x, b[1] - p.z))[0];
    const at = { phase: s.phase, player: [p.x, p.z], guard: g, hide: h, dPlayerHide: Math.hypot(h[0] - p.x, h[1] - p.z), dGuardHide: Math.hypot(h[0] - g[0], h[1] - g[1]), dGuardPlayer: Math.hypot(g[0] - p.x, g[1] - p.z), failure: s.failure?.kind };
    if (s.phase !== 'chase') return at;
    // Run straight to the hide in 50 ms steps (real held W, re-facing each step).
    AP.face(h[0], h[1]);
    AP.key('KeyW', true);
    let res = 'timeout';
    for (let i = 0; i < 200; i++) {
      const q = AP.S();
      if (q.phase === 'hidden') { res = 'hidden'; break; }
      if (q.phase === 'caught') { res = 'caught'; break; }
      if (Math.hypot(h[0] - q.player.x, h[1] - q.player.z) < 0.3) { res = 'at hide, not hidden'; break; }
      const want = Math.atan2(-(h[0] - q.player.x), -(h[1] - q.player.z));
      if (Math.abs(Math.atan2(Math.sin(want - q.player.yaw), Math.cos(want - q.player.yaw))) > 0.2) { AP.key('KeyW', false); AP.face(h[0], h[1]); AP.key('KeyW', true); }
      AP.tick(50);
    }
    AP.key('KeyW', false);
    const e = AP.S();
    at.result = res; at.tEnd = e.player; at.guardEnd = e.guard.pos;
    return at;
  });
  if (r.result === 'caught' || r.result === 'hidden') await run(page, () => AP.tick(600));
  await page.screenshot({ path: `${OUT}/chase-L${String(id).padStart(2, '0')}-${r.result}.png` });
  await run(page, () => PT2.resolve(true));
  if (await page.isVisible('#failGo')) await page.click('#failGo');
  const sol = await solveCurrent(page, `chase-L${id}`, { shots: false });
  r.stars = sol.stars; r.stats = sol.stats; r.kTried = +k.toFixed(2);
  out[id] = r;
  log(`CHASE L${id}: ${r.failure} -> ${r.result} | player→hide ${r.dPlayerHide?.toFixed(1)} m, guard→hide ${r.dGuardHide?.toFixed(1)} m, guard→player ${r.dGuardPlayer?.toFixed(1)} m | final ${sol.stars}★ ${JSON.stringify(sol.stats)}`);
  await ctx.close();
}
saveJson('chase', out);
log('console:', consoleLog.length ? consoleLog : 'none');
await closeBrowser();
