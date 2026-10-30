// Round-2 per-level playtest. For each level:
//   solve: intended solution from the pad (screens: brief, spawn, pad view, aim from drop spot,
//          success stamp, placed, results card).
//   miss:  on the first target: too big → too small → too big again (three cards, consequence
//          screenshots, chase handling), then the correct drop and the results card.
// Input is keyboard events (tests/autopilot.js) + window.advanceTime + Playwright clicks on the
// game's own buttons. Geometry (pads, standing spots) comes from the solver, as a player reads
// it off the floor rings / rulers. Nothing in the game state is written.
//   node tests/playtest2/levels.mjs solve,miss 1,2,3
import { open, S, run, log, closeBrowser, consoleLog, saveJson, OUT } from './lib.mjs';

const modes = (process.argv[2] ?? 'solve,miss').split(',');
const ids = (process.argv[3] ?? Array.from({ length: 18 }, (_, i) => i + 1).join(',')).split(',').map(Number);
const HIDE = process.env.HIDE !== '0';
const results = {};
const pad2 = (n) => String(n).padStart(2, '0');

const HELPERS = async () => {
  const { plan, findStand, targetOrder } = await import('/src/solver.ts');
  const { levelById } = await import('/src/levels.ts');
  const { Sim } = await import('/src/sim.ts');
  const { kWindow, scaledMeasure } = await import('/src/rules.ts');
  const id = AP.S().level.id;
  const L = levelById(id);
  const P = plan(L);
  window.PT2 = {
    L, P,
    info() {
      return P.map((s) => {
        const ex = L.exhibits.find((e) => e.id === s.exId);
        const m = ex.measures[s.target.measure];
        const naive = s.target.need.value / scaledMeasure(m, ex.initialScale ?? 1);
        return { tid: s.target.id, ex: s.exId, pad: s.pad, d1: s.d1, k: s.k, kMin: s.kMin, kMax: s.kMax, d2: s.d2, stand: s.stand, power: m.power, naive, anchor: s.target.anchor, zone: s.target.zone.c, orientation: s.target.orientation };
      });
    },
    /** Free standing spot at distance d from the target that can aim at it (geometry only). */
    standAt(tid, d, prefer) {
      const sim = new Sim(L);
      for (const t of targetOrder(L)) { if (t.id === tid) break; sim.solved.add(t.id); }
      const t = L.targets.find((x) => x.id === tid);
      const ex = L.exhibits.find((e) => e.id === t.accepts);
      const pad = L.pads.find((p) => p.forId === ex.id);
      sim.carry = { exId: ex.id, d1: pad.d, grab3d: 1, fromPad: true };
      return findStand(sim, t, d, prefer);
    },
    go(x, z, tol = 0.03) {
      let ok = AP.walkTo(x, z, tol);
      if (!ok) {
        // Detour through the room centre line (simple obstacle avoidance like a player would).
        const R = L.room; const p = AP.S().player;
        const mid = [(R.x0 + R.x1) / 2, (p.z + z) / 2];
        AP.walkTo(mid[0], mid[1], 0.2);
        ok = AP.walkTo(x, z, tol);
      }
      const p = AP.S().player;
      return { ok, at: [p.x, p.z], err: Math.hypot(p.x - x, p.z - z) };
    },
    grab(step) {
      const g = PT2.go(step.pad[0], step.pad[1], 0.05);
      const ex = AP.S().exhibits.find((e) => e.id === step.ex);
      AP.aimAt(ex.pos[0], ex.pos[1] + 0.15, ex.pos[2]);
      AP.act(); AP.tick(100);
      const c = AP.S().carry;
      if (c && step.orientation !== undefined) {
        for (let i = 0; i < 3 && AP.S().exhibits.find((e) => e.id === step.ex).orientation !== step.orientation; i++) AP.press('KeyR');
      }
      return { carry: c, walk: g, aim: AP.S().aim };
    },
    aimTarget(step, stand) {
      const g = PT2.go(stand[0], stand[1], 0.02);
      AP.aimAt(...step.zone);
      return { walk: g, aim: AP.S().aim };
    },
    /** After a drop: run the consequence like a player (hide if chased) until play/explain/won. */
    resolve(hide) {
      const tl = [];
      let last = '';
      for (let i = 0; i < 400; i++) {
        const s = AP.S();
        if (s.phase !== last) { tl.push(`${s.phase}@${(i * 0.1).toFixed(1)}`); last = s.phase; }
        if (s.phase === 'play' || s.phase === 'won' || s.phase === 'explain') return { phase: s.phase, tl, stats: s.stats, failure: s.failure };
        if (s.phase === 'chase' && hide && s.hides.length) {
          const p = s.player;
          const h = [...s.hides].sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.z) - Math.hypot(b[0] - p.x, b[1] - p.z))[0];
          AP.walkTo(h[0], h[1], 0.4);
          continue;
        }
        AP.tick(100);
      }
      return { phase: AP.S().phase, tl, stuck: true };
    },
    exit() {
      const WAY = { 9: [[1.5, 2.6]], 3: [[0, 1.0]] };
      for (const w of WAY[id] ?? []) AP.walkTo(w[0], w[1], 0.15);
      const e = L.exit.pos;
      AP.key('KeyW', true);
      for (let i = 0; i < 120 && AP.S().phase !== 'won'; i++) {
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

async function openLevel(id, extra = {}) {
  const { ctx, page } = await open(`?unlock=all&level=${id}`, { tag: `L${id}`, ...extra });
  await page.evaluate(() => window.advanceTime(16));
  await page.waitForTimeout(300);
  const brief = await page.evaluate(() => { const c = document.getElementById('card'); return c && !c.hidden ? c.innerText.replace(/\s+/g, ' ').trim() : null; });
  return { ctx, page, brief };
}
async function snap(page, name) { await page.waitForTimeout(60); await page.screenshot({ path: `${OUT}/${name}.png` }); }
const cardText = (page) => page.evaluate(() => { const c = document.getElementById('card'); return c && !c.hidden ? c.innerText.replace(/\s+/g, ' ').trim() : null; });
const toastText = (page) => page.evaluate(() => document.getElementById('toast')?.innerText ?? '');

async function doDrop(page, name) {
  // Drop, catch the whoosh/consequence mid-air and the stamp, then return the phase.
  await run(page, () => { AP.act(); AP.tick(300); });
  await snap(page, `${name}-a`);
  await run(page, () => AP.tick(500));
  await page.waitForTimeout(150);
  await snap(page, `${name}-b`);
  return S(page);
}

async function winCard(page, name) {
  await page.waitForTimeout(1700);
  await snap(page, name);
  return cardText(page);
}

async function solve(id) {
  const { ctx, page, brief } = await openLevel(id);
  const r = { brief };
  if (brief) await snap(page, `L${pad2(id)}-brief`);
  if (await page.$('#tutGo') && await page.isVisible('#tutGo')) await page.click('#tutGo');
  const info = await page.evaluate(HELPERS);
  r.info = info;
  await run(page, (z) => AP.aimAt(...z), info[0].zone);
  await snap(page, `L${pad2(id)}-spawn`);
  r.steps = [];
  for (const st of info) {
    const g = await run(page, (s) => { const r = PT2.go(s.pad[0], s.pad[1], 0.05); const ex = AP.S().exhibits.find((e) => e.id === s.ex); AP.aimAt(ex.pos[0], ex.pos[1] + 0.15, ex.pos[2]); return r; }, st);
    await snap(page, `L${pad2(id)}-pad-${st.ex}`);
    const gr = await run(page, (s) => PT2.grab(s), st);
    const toast = await toastText(page);
    const a = await run(page, (a) => PT2.aimTarget(a.s, a.p), { s: st, p: st.stand });
    await snap(page, `L${pad2(id)}-aim-${st.tid}`);
    const hud = await page.evaluate(() => ({ d1: document.getElementById('hudD1')?.innerText, d: document.getElementById('hudD')?.innerText, aim: document.getElementById('hudAim')?.innerText, prompt: document.getElementById('prompt')?.innerText }));
    const s2 = await doDrop(page, `L${pad2(id)}-drop-${st.tid}`);
    const stamp = await page.evaluate(() => document.getElementById('stamp')?.innerText.replace(/\s+/g, ' '));
    const res = await run(page, () => PT2.resolve(true));
    await run(page, (z) => { AP.aimAt(...z); }, st.zone);
    await snap(page, `L${pad2(id)}-placed-${st.tid}`);
    r.steps.push({ tid: st.tid, padWalk: g, grabToast: toast, carry: gr.carry, standWalk: a.walk, aim: a.aim, hud, phaseAfter: s2.phase, stamp, res: { phase: res.phase, tl: res.tl, fail: res.failure } });
    if (res.phase === 'explain') { await page.click('#failGo').catch(() => {}); }
  }
  r.exit = await run(page, () => PT2.exit());
  const f = await S(page);
  r.final = { phase: f.phase, stars: f.stars, stats: f.stats };
  r.results = await winCard(page, `L${pad2(id)}-results`);
  log(`SOLVE L${id}: ${r.final.phase} ${r.final.stars}★ ${JSON.stringify(r.final.stats)}`);
  for (const s of r.steps) log(`  ${s.tid}: d1=${s.carry?.d1} aim=${s.aim.kind}/${s.aim.id} d=${s.aim.d} want=${info.find((x) => x.tid === s.tid).d2.toFixed(3)} stamp="${s.stamp}" ${s.res.phase} hud=${JSON.stringify(s.hud)}`);
  log(`  results: ${r.results}`);
  await ctx.close();
  return r;
}

/** Wrong k candidates relative to the exact k. */
function wrongKs(st) {
  const big = [], small = [];
  if (st.power > 1 && st.naive > st.kMax * 1.02) big.push(['naive (plate ratio as k)', st.naive]);
  big.push(['k×1.25', st.k * 1.25], ['k×1.12', st.k * 1.12], ['kMax×1.05', st.kMax * 1.05]);
  if (st.power > 1 && st.naive < st.kMin * 0.98) small.push(['naive (plate ratio as k)', st.naive]);
  small.push(['k×0.75', st.k * 0.75], ['k×0.85', st.k * 0.85], ['kMin×0.95', st.kMin * 0.95], ['k×0.6', st.k * 0.6]);
  return { big, small };
}

async function miss(id) {
  const { ctx, page } = await openLevel(id);
  if (await page.$('#tutGo') && await page.isVisible('#tutGo')) await page.click('#tutGo');
  const info = await page.evaluate(HELPERS);
  const st = info[0];
  const W = wrongKs(st);
  const r = { attempts: [] };
  const plan = [['big', W.big], ['small', W.small], ['big2', W.big.slice(1)]];
  for (let i = 0; i < plan.length; i++) {
    const [label, cands] = plan[i];
    let chosen = null;
    for (const [why, k] of cands) {
      const d2 = k * st.d1;
      const stand = await run(page, (a) => PT2.standAt(a.tid, a.d, a.pref), { tid: st.tid, d: d2, pref: st.stand ?? st.pad });
      if (stand) { chosen = { why, k, d2, stand }; break; }
    }
    if (!chosen) { r.attempts.push({ label, err: 'no standing spot for any candidate' }); continue; }
    const gr = await run(page, (s) => PT2.grab(s), st);
    if (!gr.carry) { r.attempts.push({ label, err: 'grab failed', gr }); break; }
    const a = await run(page, (a) => PT2.aimTarget(a.s, a.p), { s: st, p: chosen.stand });
    const n = `L${pad2(id)}-miss${i + 1}`;
    if (i === 0) await snap(page, `${n}-aim`);
    const s2 = await doDrop(page, n);
    const toast = await toastText(page);
    // Watch the consequence: a mid-consequence shot, and the chase if any.
    let chaseShot = null;
    await run(page, () => AP.tick(600));
    const s3 = await S(page);
    if (s3.phase === 'chase') {
      await run(page, () => AP.tick(900));
      await snap(page, `${n}-chase`); chaseShot = `${n}-chase`;
    }
    const res = await run(page, (h) => PT2.resolve(h), HIDE);
    await page.waitForTimeout(200);
    const card = await cardText(page);
    await snap(page, `${n}-card`);
    r.attempts.push({ label, why: chosen.why, kTried: +chosen.k.toFixed(3), d2: +chosen.d2.toFixed(3), aimD: a.aim.d, aimKind: a.aim.kind, walkErr: +a.walk.err.toFixed(3), phaseAfterDrop: s2.phase, toast, chaseShot, timeline: res.tl, failure: res.failure, card, stats: res.stats });
    log(`MISS L${id} #${i + 1} ${label} (${chosen.why}) k=${chosen.k.toFixed(3)} d2=${chosen.d2.toFixed(2)} aim=${a.aim.kind} d=${a.aim.d} -> ${res.failure?.kind ?? res.phase} tl=${res.tl.join(',')}`);
    log(`   card: ${card}`);
    if (res.phase === 'explain') await page.click('#failGo').catch((e) => log('failGo click', e.message));
    await run(page, () => AP.tick(100));
  }
  // Then solve everything correctly.
  for (const s of info) {
    const gr = await run(page, (x) => PT2.grab(x), s);
    await run(page, (a) => PT2.aimTarget(a.s, a.p), { s, p: s.stand });
    await run(page, () => { AP.act(); AP.tick(800); });
    const res = await run(page, () => PT2.resolve(true));
    if (res.phase === 'explain') { log(`  !! correct drop failed on ${s.tid}`, res.failure); await page.click('#failGo').catch(() => {}); }
  }
  r.exit = await run(page, () => PT2.exit());
  const f = await S(page);
  r.final = { phase: f.phase, stars: f.stars, stats: f.stats };
  r.results = await winCard(page, `L${pad2(id)}-miss-results`);
  log(`MISS L${id} final: ${f.phase} ${f.stars}★ ${JSON.stringify(f.stats)} | ${r.results}`);
  await ctx.close();
  return r;
}

for (const id of ids) {
  results[id] = {};
  for (const m of modes) {
    try {
      results[id][m] = m === 'solve' ? await solve(id) : await miss(id);
    } catch (e) {
      log(`ERR L${id} ${m}: ${e.message}`);
      results[id][m] = { error: e.message };
    }
  }
  saveJson(`levels-${process.env.TAG ?? ids.join('_')}`, results);
}
log('console:', consoleLog.length ? consoleLog : 'none');
await closeBrowser();
