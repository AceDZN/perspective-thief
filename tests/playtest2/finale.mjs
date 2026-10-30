// Level 18 finale: stealth solve along the walls, the vision decal, and fairness probes.
//   node tests/playtest2/finale.mjs [part,...]   parts: solve,naive,behind,corner,decal
import { open, S, run, log, closeBrowser, consoleLog, saveJson, OUT } from './lib.mjs';
import { INSTALL } from './helpers.mjs';

const parts = (process.argv[2] ?? 'decal,solve,naive,behind,corner').split(',');
const out = {};
const snap = (page, n) => page.screenshot({ path: `${OUT}/${n}.png` });

async function start() {
  const { ctx, page } = await open('?unlock=all&level=18', { tag: 'L18' });
  await page.evaluate(() => window.advanceTime(16));
  await page.waitForTimeout(200);
  const brief = await page.evaluate(() => { const c = document.getElementById('card'); return c && !c.hidden ? c.innerText.replace(/\s+/g, ' ') : null; });
  if (brief) await snap(page, 'L18-brief');
  if (await page.isVisible('#tutGo')) await page.click('#tutGo');
  await page.evaluate(INSTALL);
  // Track spotted events by watching phase/guard each step through a wrapper on AP.tick? No: poll after moves.
  return { ctx, page, brief };
}

if (parts.includes('decal')) {
  const { ctx, page, brief } = await start();
  out.brief = brief;
  await run(page, () => AP.aimAt(0, 0, 0));
  await snap(page, 'L18-spawn-guard');
  // Closer look at the decal from 7 m, outside the cone.
  const g = (await S(page)).guard;
  out.guardAtSpawn = g;
  await run(page, () => { AP.walkTo(-4, 8, 0.1); AP.aimAt(-3, 0, 3); });
  const s = await S(page);
  out.afterWalk = { phase: s.phase, guard: s.guard, stats: s.stats };
  await snap(page, 'L18-decal-near');
  // Look at the targets from the start area.
  for (const [n, p] of [['tower', [5.25, 4, -6]], ['billboard', [-6, 2, 2]], ['loop', [-2, 0.3, -9]]]) {
    await run(page, (q) => AP.aimAt(q[0], q[1], q[2]), p);
    await snap(page, `L18-view-${n}`);
  }
  log('L18 decal', JSON.stringify(out.afterWalk));
  await ctx.close();
}

if (parts.includes('solve')) {
  // Wall route (as tests/browser-capture.mjs finale), with screenshots and spotted checks.
  const { ctx, page } = await start();
  const r = await run(page, () => {
    const L = PT2.L; const logs = []; const spotted = [];
    const chk = (where) => { const s = AP.S(); if (s.phase === 'chase' || s.stats.alarms) spotted.push(`${where}:${s.phase}:${s.stats.alarms}`); };
    const go = (pts) => { for (const p of pts) { AP.walkTo(p[0], p[1], 0.03); chk(`walk ${p}`); } };
    const grab = (id) => { const d = L.exhibits.find((e) => e.id === id); const pad = L.pads.find((p) => p.forId === id); go([pad.pos]); AP.aimAt(d.pos[0], d.pedestal + 0.2, d.pos[1]); AP.act(); AP.tick(100); logs.push(`grab ${id}: ${JSON.stringify(AP.S().carry)}`); };
    const drop = (tid, stand, k) => {
      const t = L.targets.find((x) => x.id === tid); const c = AP.S().carry;
      const dx = stand[0] - t.anchor[0], dz = stand[1] - t.anchor[2], l = Math.hypot(dx, dz); const d2 = k * c.d1;
      AP.walkTo(t.anchor[0] + (dx / l) * d2, t.anchor[2] + (dz / l) * d2, 0.02); chk(`stand ${tid}`);
      AP.aimAt(...t.zone.c);
      logs.push(`${tid}: d=${AP.S().aim.d} aim=${AP.S().aim.kind} guard=${JSON.stringify(AP.S().guard)}`);
      return t;
    };
    return { L, logs, spotted, go, grab, drop, chk };
  }).catch(() => null);
  // Functions can't cross evaluate; do the route step by step instead.
  const steps = [
    ['grab', 'ladder'], ['go', [[-11, 9], [-11, -11], [2.25, -11.3]]], ['drop', 'tower', [2.25, -11.3], 6],
    ['go', [[-11, -11], [-11, 10.6], [2, 10.6]]], ['grab', 'banner'], ['go', [[-11, 10.6], [-11, 2]]], ['drop', 'billboard', [-9.6, 2], 3],
    ['go', [[-11, 10.6], [11, 11.3], [9, 11]]], ['grab', 'crate'], ['go', [[11, 11], [11, -11.3], [-7, -11.3]]], ['drop', 'loop', [-7, -9], 2.5],
    ['go', [[-10.6, -10.6]]],
  ];
  const logs = [];
  for (const st of steps) {
    const res = await run(page, (st) => {
      const L = PT2.L;
      const spotted = () => { const s = AP.S(); return s.stats.alarms; };
      if (st[0] === 'go') { for (const p of st[1]) AP.walkTo(p[0], p[1], 0.03); return { alarms: spotted(), at: AP.S().player }; }
      if (st[0] === 'grab') { const d = L.exhibits.find((e) => e.id === st[1]); const pad = L.pads.find((p) => p.forId === st[1]); AP.walkTo(pad.pos[0], pad.pos[1], 0.03); AP.aimAt(d.pos[0], d.pedestal + 0.2, d.pos[1]); AP.act(); AP.tick(100); return { carry: AP.S().carry, alarms: spotted() }; }
      const t = L.targets.find((x) => x.id === st[1]); const c = AP.S().carry; const stand = st[2];
      const dx = stand[0] - t.anchor[0], dz = stand[1] - t.anchor[2], l = Math.hypot(dx, dz); const d2 = st[3] * c.d1;
      AP.walkTo(t.anchor[0] + (dx / l) * d2, t.anchor[2] + (dz / l) * d2, 0.02);
      AP.aimAt(...t.zone.c);
      return { aim: AP.S().aim, guard: AP.S().guard, alarms: spotted() };
    }, st);
    if (st[0] === 'drop') {
      await snap(page, `L18-aim-${st[1]}`);
      await run(page, () => { AP.act(); AP.tick(300); });
      await snap(page, `L18-drop-${st[1]}`);
      await run(page, () => { AP.tick(1100); });
      res.after = (await S(page)).targets.map((t) => `${t.id}:${t.solved}`).join(',');
    }
    logs.push(`${JSON.stringify(st.slice(0, 2))} -> ${JSON.stringify(res)}`);
  }
  await run(page, () => AP.tick(1500));
  await page.waitForTimeout(1700);
  const f = await S(page);
  await snap(page, 'L18-results');
  out.solve = { phase: f.phase, stars: f.stars, stats: f.stats, logs, card: await page.evaluate(() => document.getElementById('card')?.innerText.replace(/\s+/g, ' ')) };
  log('L18 solve', f.phase, f.stars, JSON.stringify(f.stats), '\n  ' + logs.join('\n  '), '\n  card:', out.solve.card);
  await ctx.close();
}

if (parts.includes('naive')) {
  // A player who ignores the guard: straight lines from pad to the solver's stand, in order.
  const { ctx, page } = await start();
  const info = await page.evaluate(() => PT2.info());
  const logs = [];
  for (const st of info) {
    const r = await run(page, (s) => {
      const a0 = AP.S().stats.alarms;
      const c = PT2.grab(s);
      const a1 = AP.S().stats.alarms;
      const w = PT2.aimTarget(s, s.stand);
      const a2 = AP.S().stats.alarms;
      return { carry: !!c, alarmsGrab: a1 - a0, alarmsWalk: a2 - a1, phase: AP.S().phase, aim: w.aim.kind, guard: AP.S().guard };
    }, st);
    if (r.phase === 'chase') { await run(page, () => AP.tick(800)); await snap(page, `L18-naive-spotted-${st.tid}`); }
    const res = await run(page, () => PT2.resolve(true));
    let fit = null;
    if (res.phase === 'play' && (await S(page)).carry) { await run(page, () => { AP.act(); AP.tick(1400); }); fit = (await S(page)).targets.find((t) => t.id === st.tid).solved; }
    logs.push(`${st.tid}: ${JSON.stringify(r)} resolve=${res.phase} ${res.tl?.join(',')} fit=${fit}`);
  }
  const f = await S(page);
  out.naive = { logs, stats: f.stats, solved: f.targets.map((t) => t.solved) };
  log('L18 naive', JSON.stringify(f.stats), '\n  ' + logs.join('\n  '));
  await ctx.close();
}

if (parts.includes('behind')) {
  // Stand still 1.2 m directly behind the guard (outside the drawn cone).
  const { ctx, page } = await start();
  const r = await run(page, () => {
    // Walk until the guard is on the bottom edge heading +x, then sneak behind him.
    const g0 = AP.S().guard;
    AP.walkTo(-6, 6, 0.1);
    const g = AP.S().guard; // he moved while we walked
    const yaw = Math.atan2(0, 0);
    return { g0, g, phase: AP.S().phase };
  });
  // Approach the guard from behind in small steps; log when spotted.
  const trace = await run(page, () => {
    const t = [];
    for (let i = 0; i < 80; i++) {
      const s = AP.S(); const g = s.guard.pos; const p = s.player;
      if (s.phase !== 'play') { t.push(`spotted at dist ${Math.hypot(g[0] - p.x, g[1] - p.z).toFixed(2)}`); break; }
      // Point behind the guard along his facing: we do not know yaw from text; use last two positions.
      AP.walkTo(p.x + (g[0] - p.x) * 0.15, p.z + (g[1] - p.z) * 0.15, 0.05);
      const s2 = AP.S();
      t.push(`d=${Math.hypot(s2.guard.pos[0] - s2.player.x, s2.guard.pos[1] - s2.player.z).toFixed(2)} ${s2.phase}`);
      if (s2.phase !== 'play') break;
    }
    return t;
  });
  await snap(page, 'L18-approach');
  out.behind = { r, trace };
  log('L18 approach', JSON.stringify(r), trace.slice(-6).join(' | '));
  await ctx.close();
}

if (parts.includes('corner')) {
  // Stand still just outside the cone while the guard is frozen, then take one small step:
  // does the guard advance and turn a corner into us without a fair chance?
  const { ctx, page } = await start();
  const logs = await run(page, () => {
    const logs = [];
    // Guard starts at patrol[0] (-3,-3) heading to (3,-3). Wait near (4.5,-4.5) corner-adjacent? Use (6,-1): 3 m from corner (3,-3).
    AP.walkTo(8, 4, 0.1);
    AP.walkTo(6.2, -0.5, 0.05);
    logs.push(`at ${JSON.stringify(AP.S().player)} guard ${JSON.stringify(AP.S().guard)} phase ${AP.S().phase}`);
    for (let i = 0; i < 60; i++) {
      // tiny shuffle back and forth (moving makes the guard move)
      AP.key('KeyA', true); AP.tick(150); AP.key('KeyA', false);
      AP.key('KeyD', true); AP.tick(150); AP.key('KeyD', false);
      const s = AP.S();
      if (s.phase !== 'play') { logs.push(`spotted after ${i} shuffles: player ${JSON.stringify(s.player)} guard ${JSON.stringify(s.guard)}`); break; }
      if (i % 10 === 0) logs.push(`#${i} guard ${JSON.stringify(s.guard.pos)}`);
    }
    return logs;
  });
  await snap(page, 'L18-corner');
  out.corner = logs;
  log('L18 corner', '\n  ' + logs.join('\n  '));
  await ctx.close();
}

saveJson(`finale-${parts.join('_')}`, out);
log('console:', consoleLog.length ? consoleLog : 'none');
await closeBrowser();
