// Shared in-page helpers for round-2 flows. Reads the current level (read-only, like
// render_game_to_text) to plan pads and standing spots; all actions are keyboard events.
import { S, run, log, OUT } from './lib.mjs';

export const INSTALL = async () => {
  const { plan, findStand, targetOrder } = await import('/src/solver.ts');
  const { Sim } = await import('/src/sim.ts');
  const L = window.__pt.sim.level;
  const P = plan(L);
  window.PT2 = {
    L, P,
    info() { return P.map((s) => ({ tid: s.target.id, ex: s.exId, pad: s.pad, d1: s.d1, k: s.k, kMin: s.kMin, kMax: s.kMax, d2: s.d2, stand: s.stand, zone: s.target.zone.c, orientation: s.target.orientation, plate: s.target.plate.join(' · ') })); },
    standAt(tid, d, prefer) {
      const sim = new Sim(L);
      for (const t of targetOrder(L)) { if (t.id === tid) break; sim.solved.add(t.id); }
      const t = L.targets.find((x) => x.id === tid);
      const pad = L.pads.find((p) => p.forId === t.accepts);
      sim.carry = { exId: t.accepts, d1: pad.d, grab3d: 1, fromPad: true };
      return findStand(sim, t, d, prefer);
    },
    go(x, z, tol = 0.03) {
      let ok = AP.walkTo(x, z, tol);
      if (!ok) { const R = L.room; const p = AP.S().player; AP.walkTo((R.x0 + R.x1) / 2, (p.z + z) / 2, 0.2); ok = AP.walkTo(x, z, tol); }
      const p = AP.S().player;
      return { ok, err: Math.hypot(p.x - x, p.z - z) };
    },
    grab(step) {
      PT2.go(step.pad[0], step.pad[1], 0.05);
      const ex = AP.S().exhibits.find((e) => e.id === step.ex);
      AP.aimAt(ex.pos[0], ex.pos[1] + 0.15, ex.pos[2]);
      AP.act(); AP.tick(100);
      const c = AP.S().carry;
      if (c && step.orientation !== undefined) for (let i = 0; i < 3 && AP.S().exhibits.find((e) => e.id === step.ex).orientation !== step.orientation; i++) AP.press('KeyR');
      return c;
    },
    aimTarget(step, stand) { const g = PT2.go(stand[0], stand[1], 0.02); AP.aimAt(...step.zone); return { walk: g, aim: AP.S().aim }; },
    resolve(hide = true) {
      const tl = []; let last = '';
      for (let i = 0; i < 400; i++) {
        const s = AP.S();
        if (s.phase !== last) { tl.push(`${s.phase}@${(i * 0.1).toFixed(1)}`); last = s.phase; }
        if (['play', 'won', 'explain'].includes(s.phase)) return { phase: s.phase, tl, failure: s.failure };
        if (s.phase === 'chase' && hide && s.hides.length) { const p = s.player; const h = [...s.hides].sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.z) - Math.hypot(b[0] - p.x, b[1] - p.z))[0]; AP.walkTo(h[0], h[1], 0.4); continue; }
        AP.tick(100);
      }
      return { phase: AP.S().phase, tl, stuck: true };
    },
    exit(way = []) {
      for (const w of way) AP.walkTo(w[0], w[1], 0.15);
      const e = L.exit.pos;
      AP.key('KeyW', true);
      for (let i = 0; i < 150 && AP.S().phase !== 'won'; i++) {
        const p = AP.S().player;
        const want = Math.atan2(-(e[0] - p.x), -(e[2] - p.z));
        if (Math.abs(Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw))) > 0.25) { AP.key('KeyW', false); AP.face(e[0], e[2]); AP.key('KeyW', true); }
        AP.tick(100);
      }
      AP.key('KeyW', false); AP.tick(200);
      return AP.S().phase;
    },
  };
  return PT2.info();
};

const WAY = { 9: [[1.5, 2.6]], 3: [[0, 1.0]] };
export const cardText = (page) => page.evaluate(() => { const c = document.getElementById('card'); return c && !c.hidden ? c.innerText.replace(/\s+/g, ' ').trim() : null; });

/** Solve whatever level is currently loaded (after the briefing). Returns final state + results text. */
export async function solveCurrent(page, prefix, { shots = true } = {}) {
  const info = await page.evaluate(INSTALL);
  const id = (await S(page)).level.id;
  const steps = [];
  for (const st of info) {
    const c = await run(page, (s) => PT2.grab(s), st);
    const a = await run(page, (x) => PT2.aimTarget(x.s, x.p), { s: st, p: st.stand });
    if (shots) await page.screenshot({ path: `${OUT}/${prefix}-aim-${st.tid}.png` });
    await run(page, () => { AP.act(); AP.tick(800); });
    const res = await run(page, () => PT2.resolve(true));
    steps.push({ tid: st.tid, d1: c?.d1, d: a.aim.d, aim: a.aim.kind, want: +st.d2.toFixed(3), res: res.phase, fail: res.failure?.kind });
    if (res.phase === 'explain') await page.click('#failGo').catch(() => {});
  }
  const exit = await run(page, (w) => PT2.exit(w), WAY[id] ?? []);
  await page.waitForTimeout(1700);
  if (shots) await page.screenshot({ path: `${OUT}/${prefix}-results.png` });
  const f = await S(page);
  const results = await cardText(page);
  log(`[${prefix}] L${id} ${f.phase} ${f.stars}★ steps=${JSON.stringify(steps)}`);
  return { id, info, steps, exit, phase: f.phase, stars: f.stars, stats: f.stats, results };
}
