// Scenario runner for mistakes, bypass hunting and UI checks. Usage:
//   node tests/playtest/play.mjs scenarioA,scenarioB
// Every action is keyboard input (tests/autopilot.js) or a Playwright click/tap; level geometry
// comes from a static dump of src/levels.ts (what a player would read off placards and the floor).
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { retry, open, S, run, shot, passTutorial, cardText, hudText, log, closeBrowser, consoleLog, saveJson, OUT } from './lib.mjs';

const LV = JSON.parse(execSync('npx tsx tests/playtest/dump-levels.ts', { encoding: 'utf8' }));
const L = (id) => LV.find((l) => l.id === id);

// In-page helpers (installed after the autopilot).
const HELPERS = () => {
  window.PT = {
    grab(ex, standAt) {
      const e = AP.S().exhibits.find((x) => x.id === ex);
      if (standAt) AP.walkTo(standAt[0], standAt[1], 0.03);
      AP.aimAt(e.pos[0], e.pos[1] + 0.15, e.pos[2]);
      AP.act(); AP.tick(120);
      return AP.S().carry;
    },
    /** Stand at distance d2 from the target anchor along `dir` (unit, xz) and aim at `aim`. */
    standFor(anchor, d2, dir, aim) {
      AP.walkTo(anchor[0] + dir[0] * d2, anchor[2] + dir[1] * d2, 0.02);
      AP.aimAt(aim[0], aim[1], aim[2]);
      return AP.S().aim;
    },
    waitPhase(want, maxMs = 15000) {
      for (let t = 0; t < maxMs; t += 100) { if ([].concat(want).includes(AP.S().phase)) return true; AP.tick(100); }
      return false;
    },
  };
  return 'ok';
};

async function level(id, opts = {}) {
  const { ctx, page } = await open(`?unlock=all&level=${id}`, { tag: `L${id}`, ...opts });
  await passTutorial(page);
  await page.evaluate(HELPERS);
  return { ctx, page };
}
const dirFrom = (a, p) => { const dx = p[0] - a[0], dz = p[1] - a[2], l = Math.hypot(dx, dz); return [dx / l, dz / l]; };

const results = {};
const scenarios = {
  // 2a: the headline mistake. Level 12 at k = 9 → roof crash, alarm, chase, hide, worked card.
  async l12k9() {
    const lv = L(12), t = lv.targets[0], pad = lv.pads[0];
    const { ctx, page } = await level(12);
    const c = await run(page, (p) => PT.grab('painting', p), pad.pos);
    const d2 = 9 * c.d1;
    const dir = [0, 1];
    const aim = await run(page, (a) => PT.standFor(a.anchor, a.d2, a.dir, a.c), { anchor: t.anchor, d2, dir, c: t.zone.c });
    log('L12 k=9 aim', aim, 'need d2', d2);
    await shot(page, 'p02a-l12-aim-10.8m');
    await run(page, () => { AP.act(); AP.tick(300); });
    await shot(page, 'p02b-l12-whoosh');
    await run(page, () => { AP.tick(500); });
    let s = await shot(page, 'p02c-l12-roofcrash');
    log('L12 after drop', s.phase, s.failure);
    await run(page, () => { AP.pitchTo(0.5); });
    await shot(page, 'p02c2-l12-roofcrash-lookup');
    await run(page, () => { PT.waitPhase('chase'); AP.tick(1200); const g = AP.S().guard.pos; AP.face(g[0], g[1]); AP.pitchTo(0); });
    s = await shot(page, 'p02d-l12-guard-chase');
    log('L12 chase', s.phase, s.guard, await hudText(page));
    await run(page, () => { const h = AP.S().hides[0]; AP.walkTo(h[0], h[1], 0.5); AP.tick(400); });
    s = await shot(page, 'p02e-l12-hidden');
    log('L12 hidden', s.phase, s.guard);
    await run(page, () => { AP.tick(2500); });
    await shot(page, 'p02e2-l12-hidden-search');
    await run(page, () => PT.waitPhase('explain', 20000));
    s = await shot(page, 'p02f-l12-worked-card');
    log('L12 card', await cardText(page), s.failure, s.stats);
    results.l12k9 = { card: await cardText(page), failure: s.failure, stats: s.stats };
    // Dismiss with E and solve properly: is the painting back?
    await run(page, () => { AP.act(); AP.tick(100); });
    s = await S(page);
    log('L12 after dismiss', s.phase, s.exhibits, s.player);
    const c2 = await run(page, (p) => PT.grab('painting', p), pad.pos);
    await run(page, (a) => PT.standFor(a.anchor, a.d2, a.dir, a.c), { anchor: t.anchor, d2: 3 * c2.d1, dir, c: t.zone.c });
    await run(page, () => { AP.act(); AP.tick(1200); });
    s = await shot(page, 'p02g-l12-solved-after-fail');
    log('L12 retry solved', s.targets.map((x) => x.solved), s.stats);
    await ctx.close();
  },
  // 2b: getting caught instead of hiding (L12 again, stand still during the chase).
  async l12caught() {
    const lv = L(12), t = lv.targets[0], pad = lv.pads[0];
    const { ctx, page } = await level(12);
    const c = await run(page, (p) => PT.grab('painting', p), pad.pos);
    await run(page, (a) => PT.standFor(a.anchor, a.d2, a.dir, a.c), { anchor: t.anchor, d2: 9 * c.d1, dir: [0, 1], c: t.zone.c });
    await run(page, () => { AP.act(); PT.waitPhase('chase'); });
    let s;
    for (let i = 0; i < 12; i++) {
      await run(page, () => AP.tick(500));
      s = await S(page);
      if (s.phase === 'caught') break;
    }
    s = await shot(page, 'p02h-l12-caught');
    log('L12 caught', s.phase, s.guard, s.player, await hudText(page));
    await run(page, () => PT.waitPhase(['explain', 'play'], 15000));
    s = await shot(page, 'p02i-l12-after-caught');
    log('L12 after caught', s.phase, s.player, s.stats, await cardText(page));
    await ctx.close();
  },
  // 2c: too-small drops: L1 at 5 m (k = d2 − d1 thinking) → fallThrough; L2 too close → blownAway; L4 at 2.7 → pocketed.
  async small() {
    for (const [id, ex, kind, d2f] of [[1, 'cube', 'd2-d1', (d1) => d1 + 3], [2, 'dino', 'too close', () => 1.6], [4, 'bust', 'additive', (d1) => d1 + 0.3]]) {
      const lv = L(id), t = lv.targets[0], pad = lv.pads[0];
      const { ctx, page } = await level(id);
      const c = await run(page, (a) => PT.grab(a.ex, a.p), { ex, p: pad.pos });
      const d2 = d2f(c.d1);
      const st = await S(page);
      const dir = dirFrom(t.anchor, [st.player.x, st.player.z]);
      const aim = await run(page, (a) => PT.standFor(a.anchor, a.d2, a.dir, a.c), { anchor: t.anchor, d2, dir, c: t.zone.c });
      log(`L${id} ${kind} aim`, aim);
      await run(page, () => { AP.act(); AP.tick(700); });
      await shot(page, `p03-L${id}-${kind.replace(/\s/g, '')}-consequence`);
      await run(page, () => AP.tick(800));
      await shot(page, `p03-L${id}-${kind.replace(/\s/g, '')}-consequence2`);
      await run(page, () => PT.waitPhase('explain', 12000));
      const s = await shot(page, `p03-L${id}-${kind.replace(/\s/g, '')}-card`);
      log(`L${id} ${kind}`, s.phase, s.failure, await cardText(page));
      results[`small-${id}`] = { failure: s.failure, card: await cardText(page) };
      await ctx.close();
    }
  },
  // 2d: L8 right k, wrong orientation → jam; then rotate and solve.
  async l8jam() {
    const lv = L(8), t = lv.targets[0], pad = lv.pads[0];
    const { ctx, page } = await level(8);
    const c = await run(page, (p) => PT.grab('sign', p), pad.pos);
    let s = await shot(page, 'p04a-l8-holding-sign');
    log('L8 held', s.exhibits[0], await hudText(page));
    const dir = [0, 1];
    await run(page, (a) => PT.standFor(a.anchor, a.d2, a.dir, a.c), { anchor: t.anchor, d2: 2 * c.d1, dir, c: t.zone.c });
    await shot(page, 'p04b-l8-aim-frame');
    await run(page, () => { AP.act(); AP.tick(700); });
    await shot(page, 'p04c-l8-jam');
    await run(page, () => PT.waitPhase('explain', 12000));
    s = await shot(page, 'p04d-l8-jam-card');
    log('L8 jam', s.failure, await cardText(page));
    results.l8jam = { failure: s.failure, card: await cardText(page) };
    await run(page, () => { AP.act(); AP.tick(100); });
    // Rotate and retry: how many R presses to orientation 0?
    await run(page, (p) => PT.grab('sign', p), pad.pos);
    const orients = [];
    for (let i = 0; i < 3; i++) {
      s = await S(page);
      orients.push(s.exhibits[0].orientation);
      if (s.exhibits[0].orientation === 0) break;
      await run(page, () => AP.press('KeyR'));
      await shot(page, `p04e-l8-rotated-${i + 1}`);
    }
    log('L8 orientations seen', orients);
    await run(page, (a) => PT.standFor(a.anchor, a.d2, a.dir, a.c), { anchor: t.anchor, d2: 2 * c.d1, dir, c: t.zone.c });
    await run(page, () => { AP.act(); AP.tick(1200); });
    s = await shot(page, 'p04f-l8-solved');
    log('L8 solved', s.targets[0].solved, s.stats);
    await ctx.close();
  },
  // 2e: L15 rectangle (equal area, not similar) → noFit at the "right" k and at another k.
  async l15nofit() {
    const lv = L(15), t = lv.targets[0];
    const { ctx, page } = await level(15);
    let s = await shot(page, 'p05a-l15-start');
    const padR = lv.pads.find((p) => p.forId === 'rect');
    const c = await run(page, (p) => PT.grab('rect', p), padR.pos);
    log('L15 rect carry', c);
    await run(page, (a) => PT.standFor(a.anchor, a.d2, a.dir, a.c), { anchor: t.anchor, d2: 3 * c.d1, dir: [0, 1], c: t.zone.c });
    await shot(page, 'p05b-l15-rect-aim');
    await run(page, () => { AP.act(); AP.tick(700); });
    await shot(page, 'p05c-l15-nofit');
    await run(page, () => PT.waitPhase('explain', 12000));
    s = await shot(page, 'p05d-l15-nofit-card');
    log('L15 noFit', s.failure, await cardText(page));
    results.l15 = { failure: s.failure, card: await cardText(page) };
    await ctx.close();
  },
  // 2a': watch the guard come in from a distance, then hide right away.
  async chase() {
    const lv = L(12), t = lv.targets[0], pad = lv.pads[0];
    const { ctx, page } = await level(12);
    const c = await run(page, (p) => PT.grab('painting', p), pad.pos);
    await run(page, (a) => PT.standFor(a.anchor, a.d2, a.dir, a.c), { anchor: t.anchor, d2: 9 * c.d1, dir: [0, 1], c: t.zone.c });
    await run(page, () => { AP.act(); AP.tick(50); });
    // During the 1.6 s consequence, turn toward the guard door (6, 2).
    await run(page, (d) => { AP.face(d[0], d[1]); AP.pitchTo(0.05); }, lv.guardDoor);
    await run(page, () => PT.waitPhase('chase'));
    let s;
    for (let i = 0; i < 4; i++) {
      await run(page, () => AP.tick(250));
      s = await shot(page, `p02j-guard-approach-${i}`);
      log('guard approach', i, s.guard, s.player);
    }
    // Run to the hide spot.
    await run(page, () => { const h = AP.S().hides[0]; AP.walkTo(h[0], h[1], 0.5); AP.tick(50); });
    s = await shot(page, 'p02k-hidden-view');
    log('hide result', s.phase, s.guard, s.stats);
    for (let i = 0; i < 4; i++) { await run(page, () => AP.tick(1000)); s = await shot(page, `p02l-hidden-${i}`); log('hidden', i, s.phase, s.guard); if (s.phase !== 'hidden') break; }
    await run(page, () => PT.waitPhase('explain', 15000));
    s = await shot(page, 'p02m-after-hide-card');
    log('after hide', s.phase, s.player, s.stats, await cardText(page));
    await ctx.close();
  },
};

const want = (process.argv[2] ?? Object.keys(scenarios).join(',')).split(',');
for (const name of want) {
  if (!scenarios[name]) { log('unknown scenario', name); continue; }
  try { await retry(name, scenarios[name]); log('ok', name); } catch (e) { log('FAIL', name, e.stack ?? e.message); }
}
saveJson(`results-${want.join('_').slice(0, 60)}`, { results, console: consoleLog });
log('console:', consoleLog);
await closeBrowser();
