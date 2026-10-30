// L18: too-big then too-small then too-big ladder on the tower (wall route), cards and chase on the roof.
import { open, S, run, log, closeBrowser, OUT } from './lib.mjs';
import { INSTALL, cardText } from './helpers.mjs';
const { ctx, page } = await open('?unlock=all&level=18', { tag: 'm18' });
await page.evaluate(() => window.advanceTime(16));
await page.waitForTimeout(200);
if (await page.isVisible('#tutGo')) await page.click('#tutGo');
await page.evaluate(INSTALL);
for (const [i, k] of [[1, 7.5], [2, 4.5], [3, 6.8]]) {
  const r = await run(page, (k) => {
    const L = PT2.L; const d = L.exhibits.find((e) => e.id === 'ladder'); const pad = L.pads.find((p) => p.forId === 'ladder');
    for (const p of [[-11, 9], [pad.pos[0], pad.pos[1]]]) AP.walkTo(p[0], p[1], 0.03);
    AP.aimAt(d.pos[0], d.pedestal + 0.2, d.pos[1]); AP.act(); AP.tick(100);
    const c = AP.S().carry;
    for (const p of [[-11, 9], [-11, -11.3]]) AP.walkTo(p[0], p[1], 0.03);
    const t = L.targets.find((x) => x.id === 'tower'); const stand = [2.25, -11.3];
    const dx = stand[0] - t.anchor[0], dz = stand[1] - t.anchor[2], l = Math.hypot(dx, dz);
    AP.walkTo(t.anchor[0] + (dx / l) * k * c.d1, t.anchor[2] + (dz / l) * k * c.d1, 0.02);
    AP.aimAt(...t.zone.c);
    const a = AP.S().aim; const al = AP.S().stats.alarms;
    AP.act(); AP.tick(1300);
    return { carry: c, aim: a, alarmsBefore: al, phase: AP.S().phase, failure: AP.S().failure };
  }, k);
  await page.screenshot({ path: `${OUT}/L18-miss${i}-b.png` });
  let chase = null;
  if (r.phase === 'chase' || (await S(page)).phase === 'chase') {
    await run(page, () => AP.tick(1200));
    await page.screenshot({ path: `${OUT}/L18-miss${i}-chase.png` });
    chase = await run(page, () => { const s = AP.S(); const p = s.player; const ds = s.hides.map((h) => Math.hypot(h[0] - p.x, h[1] - p.z)); return { player: p, guard: s.guard.pos, hideDists: ds }; });
  }
  const res = await run(page, () => PT2.resolve(true));
  await page.waitForTimeout(200);
  const c = await cardText(page);
  await page.screenshot({ path: `${OUT}/L18-miss${i}-card.png` });
  log(`L18 miss${i} k=${k}: aim=${r.aim.kind}/${r.aim.d} -> ${res.failure?.kind ?? res.phase} tl=${res.tl?.join(',')} chase=${JSON.stringify(chase)}\n   card: ${c}`);
  if (await page.isVisible('#failGo')) await page.click('#failGo');
}
log('stats', JSON.stringify((await S(page)).stats));
await ctx.close();
await closeBrowser();
