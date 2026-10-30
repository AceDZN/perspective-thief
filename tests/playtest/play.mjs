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

const MAP = JSON.parse(readFileSync(`${OUT}/stands.json`, 'utf8'));
const ORDER = (id) => MAP.table.filter((r) => r.level === id);
function standFor(id, tid, d2) {
  const lv = L(id), t = lv.targets.find((x) => x.id === tid);
  const st = MAP.stands[`${id}:${tid}`];
  let best = null;
  for (const [k, p] of Object.entries(st)) if (p && (!best || Math.abs(+k - d2) < Math.abs(best.k - d2))) best = { k: +k, p };
  if (!best) return null;
  const dx = best.p[0] - t.anchor[0], dz = best.p[1] - t.anchor[2], l = Math.hypot(dx, dz);
  return [t.anchor[0] + (dx / l) * d2, t.anchor[2] + (dz / l) * d2];
}
const WAY = { 9: [[1.5, 2.6]], 3: [[0, 1.0]] };

/** Plays one level with a drop-distance strategy. strategy(ctx) → d2 for this attempt (ctx has d1, attempt, lastCard). */
async function playLevel(id, strategy, { maxAttempts = 4, tag = '' } = {}) {
  const lv = L(id);
  const { ctx, page } = await level(id);
  const log2 = [];
  for (const row of ORDER(id)) {
    const t = lv.targets.find((x) => x.id === row.target);
    const pad = lv.pads.find((p) => p.forId === t.accepts);
    let lastCard = null, solved = false, rotations = 0;
    for (let attempt = 1; attempt <= maxAttempts && !solved; attempt++) {
      const c = await run(page, (a) => PT.grab(a.ex, a.p), { ex: t.accepts, p: pad.pos });
      if (!c) { log2.push(`${t.id}: no grab`); break; }
      if (lastCard && /סובבו/.test(lastCard)) { rotations++; for (let r = 0; r < rotations; r++) await run(page, () => AP.press('KeyR')); }
      const d2 = strategy({ d1: c.d1, attempt, lastCard, row });
      const stand = standFor(id, t.id, d2);
      if (!stand) { log2.push(`${t.id}: no stand for d2=${d2.toFixed(2)}`); break; }
      const aim = await run(page, (a) => { AP.walkTo(a.s[0], a.s[1], 0.02); AP.aimAt(a.c[0], a.c[1], a.c[2]); return AP.S().aim; }, { s: stand, c: t.zone.c });
      await run(page, () => { AP.act(); AP.tick(800); });
      // Resolve the consequence like a player: hide if chased, read the card, dismiss it.
      const res = await run(page, () => {
        for (let i = 0; i < 200; i++) {
          const s = AP.S();
          if (s.phase === 'play' || s.phase === 'won') return { phase: s.phase };
          if (s.phase === 'explain') return { phase: 'explain', card: document.getElementById('card').innerText.replace(/\s+/g, ' ') };
          if (s.phase === 'chase') {
            const p = s.player; const h = s.hides.slice().sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.z) - Math.hypot(b[0] - p.x, b[1] - p.z))[0];
            AP.walkTo(h[0], h[1], 0.5);
          }
          AP.tick(150);
        }
        return { phase: AP.S().phase };
      });
      const st = await S(page);
      solved = st.targets.find((x) => x.id === t.id).solved;
      log2.push(`${t.id} try${attempt}: d1=${c.d1} d2=${aim.d} aim=${aim.kind}${aim.id === t.id ? '' : '!' + aim.id} -> ${solved ? 'FIT' : st.failure?.kind ?? res.phase}`);
      if (res.phase === 'explain') { lastCard = res.card; await run(page, () => { AP.act(); AP.tick(50); }); }
    }
  }
  for (const w of WAY[id] ?? []) await run(page, (w) => AP.walkTo(w[0], w[1], 0.15), w);
  const fin = await run(page, (e) => {
    AP.key('KeyW', true);
    for (let i = 0; i < 80 && AP.S().phase !== 'won'; i++) { const p = AP.S().player; const want = Math.atan2(-(e[0] - p.x), -(e[2] - p.z)); if (Math.abs(Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw))) > 0.25) { AP.key('KeyW', false); AP.face(e[0], e[2]); AP.key('KeyW', true); } AP.tick(100); }
    AP.key('KeyW', false); AP.tick(1200);
    const f = AP.S(); return { phase: f.phase, stars: f.stars, stats: f.stats };
  }, lv.exit.pos);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/p09-${tag}-L${String(id).padStart(2, '0')}.png` });
  await ctx.close();
  return { ...fin, log: log2 };
}
const kFromCard = (card) => { const m = card && card.match(/היה צריך k = ([0-9.]+)/); return m ? +m[1] : null; };

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
  // 3a: hint (H key and the button), star cost, persistence of the hint box.
  async hint() {
    const { ctx, page } = await level(12);
    let s = await S(page);
    await page.keyboard.press('KeyH');
    await page.evaluate(() => window.advanceTime(16));
    s = await shot(page, 'p06a-l12-hint');
    log('hint H', s.stats, await hudText(page));
    await page.click('#btnHint');
    s = await S(page);
    log('hint button again', s.stats);
    // Solve cleanly after the hint: how many stars?
    const lv = L(12), t = lv.targets[0], pad = lv.pads[0];
    const c = await run(page, (p) => PT.grab('painting', p), pad.pos);
    await run(page, (a) => PT.standFor(a.anchor, a.d2, a.dir, a.c), { anchor: t.anchor, d2: 3 * c.d1, dir: [0, 1], c: t.zone.c });
    await run(page, () => { AP.act(); AP.tick(1500); });
    await run(page, (e) => { AP.walkTo(e[0], e[2], 0.3); AP.key('KeyW', true); for (let i = 0; i < 30 && AP.S().phase !== 'won'; i++) AP.tick(100); AP.key('KeyW', false); AP.tick(1200); }, lv.exit.pos);
    await page.waitForTimeout(1300);
    s = await shot(page, 'p06b-l12-win-after-hint');
    log('win after hint', s.phase, s.stars, s.stats, await cardText(page));
    // Finale: hint is disabled.
    await ctx.close();
    const f = await level(18);
    await f.page.keyboard.press('KeyH');
    await f.page.evaluate(() => window.advanceTime(16));
    s = await shot(f.page, 'p06c-l18-no-hint');
    log('L18 hint', s.stats, await hudText(f.page), await f.page.evaluate(() => document.getElementById('btnHint').disabled));
    await f.ctx.close();
  },
  // 3b: pause (P / button), mute (M / button / pause toggle), restart from pause, Escape.
  async pause() {
    const { ctx, page } = await level(1);
    const pad = L(1).pads[0];
    await run(page, (p) => PT.grab('cube', p), pad.pos);
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(200);
    let s = await shot(page, 'p07a-pause');
    log('paused', s.paused, s.carry, await page.evaluate(() => document.getElementById('overlay').innerText.replace(/\s+/g, ' ')));
    // Does time stop while paused?
    const before = (await S(page)).player;
    await run(page, () => { AP.key('KeyW', true); window.advanceTime(1000); AP.key('KeyW', false); });
    const after = (await S(page)).player;
    log('moved while paused?', before.z, after.z);
    await page.click('#optMute');
    log('mute via pause toggle', await page.evaluate(() => document.getElementById('btnMute').textContent));
    await page.click('#pRestart');
    await page.waitForTimeout(300);
    s = await shot(page, 'p07b-after-restart');
    log('after restart', s.paused, s.card, s.carry, s.player, s.exhibits[0].state, s.stats);
    await passTutorial(page);
    await page.keyboard.press('KeyM');
    log('mute after M', await page.evaluate(() => document.getElementById('btnMute').textContent));
    await page.click('#btnMute');
    log('mute after button', await page.evaluate(() => document.getElementById('btnMute').textContent));
    await page.click('#btnPause');
    s = await S(page);
    log('pause button', s.paused);
    await page.click('#pMap');
    await page.waitForTimeout(800);
    s = await shot(page, 'p07c-pause-to-map');
    log('to map', s.mode, s.selected);
    await ctx.close();
  },
  // 3c: mobile 390×844 with touch: menu, tutorial, HUD, stick, look drag, act button, fail card, win card.
  async mobile() {
    const { ctx, page } = await open('', { width: 390, height: 844, touch: true, tag: 'mobile' });
    await page.waitForTimeout(1200);
    await shot(page, 'p08a-mobile-menu');
    await page.tap('#btnContinue');
    await page.waitForTimeout(600);
    await shot(page, 'p08b-mobile-tutorial');
    await page.tap('#tutGo');
    await page.evaluate(HELPERS);
    let s = await shot(page, 'p08c-mobile-hud');
    log('mobile hud', await hudText(page));
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    // Left stick: push forward for 1 s.
    await touch('touchStart', [{ x: 80, y: 650, id: 1 }]);
    await touch('touchMove', [{ x: 80, y: 600, id: 1 }]);
    await page.evaluate(() => window.advanceTime(1000));
    await shot(page, 'p08d-mobile-stick');
    await touch('touchEnd', []);
    const p1 = (await S(page)).player;
    log('after stick forward 1 s', p1);
    // Look drag on the right side: turn left ~45°.
    await touch('touchStart', [{ x: 300, y: 400, id: 2 }]);
    for (let i = 1; i <= 10; i++) { await touch('touchMove', [{ x: 300 - i * 12, y: 400, id: 2 }]); await page.evaluate(() => window.advanceTime(16)); }
    await touch('touchEnd', []);
    log('after look drag', (await S(page)).player);
    // Go to the pad (autopilot keys still work on a touch device), then grab with the act button.
    await run(page, (p) => { AP.walkTo(p[0], p[1], 0.03); AP.aimAt(-2.5, 1.15, 0); }, L(1).pads[0].pos);
    await page.tap('#tAct');
    await page.evaluate(() => window.advanceTime(32));
    s = await shot(page, 'p08e-mobile-grabbed');
    log('mobile grab via button', s.carry, await hudText(page));
    // Too-small drop for the fail card on mobile.
    await run(page, () => { AP.walkTo(0, -4.22 + 4, 0.03); AP.aimAt(0, 0.75, -4.22); });
    await page.tap('#tAct');
    await page.evaluate(() => { for (let i = 0; i < 40 && JSON.parse(window.render_game_to_text()).phase !== 'explain'; i++) window.advanceTime(100); });
    s = await shot(page, 'p08f-mobile-fail-card');
    log('mobile fail', s.phase, await cardText(page));
    await page.tap('#failGo').catch(async () => { await page.tap('#tAct'); });
    await page.evaluate(() => window.advanceTime(32));
    s = await S(page);
    log('after dismiss on mobile', s.phase, s.card);
    // Solve and win on mobile.
    await run(page, (p) => PT.grab('cube', p), L(1).pads[0].pos);
    await run(page, () => { AP.walkTo(0, 1.78, 0.02); AP.aimAt(0, 0.75, -4.22); });
    await page.tap('#tAct');
    await page.evaluate(() => window.advanceTime(1500));
    s = await shot(page, 'p08g-mobile-placed');
    // Climb button?
    await run(page, () => { AP.walkTo(0, -3.0, 0.1); AP.turnTo(0); AP.pitchTo(0); });
    s = await shot(page, 'p08h-mobile-at-step');
    log('climb btn hidden?', await page.evaluate(() => document.getElementById('tClimb').hidden));
    await page.tap('#tClimb').catch((e) => log('tClimb tap failed', e.message.split('\n')[0]));
    await page.evaluate(() => window.advanceTime(300));
    log('after climb tap', (await S(page)).player);
    await run(page, () => { AP.key('KeyW', true); for (let i = 0; i < 40 && AP.S().phase !== 'won'; i++) AP.tick(100); AP.key('KeyW', false); AP.tick(1200); });
    await page.waitForTimeout(1300);
    s = await shot(page, 'p08i-mobile-win');
    log('mobile end', s.phase, s.stars, await cardText(page));
    await ctx.close();
  },
  // 4a: "fail once on purpose, read k off the card": first drop at d2 = d1 (k = 1), then d2 = k_card · d1.
  async failread() {
    const ids = (process.env.LEVELS ?? '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17').split(',').map(Number);
    for (const id of ids) {
      const r = await retry(`failread-${id}`, () => playLevel(id, ({ d1, lastCard }) => { const k = kFromCard(lastCard); return k ? k * d1 : (lastCard ? 0 : d1); }, { tag: 'failread' }));
      results[`failread-${id}`] = r;
      log(`failread L${id}`, r.phase, r.stars, JSON.stringify(r.stats), r.log.join(' | '));
    }
  },
  // 4b: constant multiplier (CONST env, default 3) for every target, up to 3 tries at the same distance.
  async constant() {
    const c = Number(process.env.CONST ?? 3);
    const ids = (process.env.LEVELS ?? '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17').split(',').map(Number);
    for (const id of ids) {
      const r = await retry(`const-${id}`, () => playLevel(id, ({ d1 }) => c * d1, { maxAttempts: 1, tag: `const${c}` }));
      results[`const${c}-${id}`] = r;
      log(`const x${c} L${id}`, r.phase, r.stars, r.log.join(' | '));
    }
  },
  // 5a: can the shadow lengths be read off the floor rulers? (L6, L7, L10, L18)
  async shadows() {
    const { ctx, page } = await level(6);
    await shot(page, 'p10a-l6-spawn');
    await run(page, () => { AP.aimAt(2.5, 3.5, -6); });
    await shot(page, 'p10b-l6-statue');
    await run(page, () => { AP.walkTo(1.2, 5.2); AP.aimAt(2.5, 0, 3); });
    await shot(page, 'p10c-l6-statue-shadow-tip');
    await run(page, () => { AP.walkTo(1.0, 1.0); AP.aimAt(2.5, 0, -1); });
    await shot(page, 'p10d-l6-statue-ruler-mid');
    await run(page, () => { AP.walkTo(-2.6, 0.6); AP.aimAt(-4, 0, -1.6); });
    await shot(page, 'p10e-l6-mannequin-shadow');
    await run(page, () => { AP.walkTo(-4, 0.4); AP.turnTo(0); AP.pitchTo(-0.9); });
    await shot(page, 'p10f-l6-mannequin-ruler-down');
    await ctx.close();
    for (const id of [7, 10]) {
      const r = await level(id);
      await shot(r.page, `p10g-l${id}-spawn`);
      await r.ctx.close();
    }
    const f = await level(18);
    await shot(f.page, 'p10h-l18-spawn');
    await run(f.page, () => { AP.aimAt(5.25, 4, -6); });
    await shot(f.page, 'p10i-l18-tower');
    await f.ctx.close();
  },
  // 5b: floor preview + k = 1 transfer (L1) — no failure, one regrab.
  async floorpreview() {
    const { ctx, page } = await level(1);
    const pad = L(1).pads[0];
    await run(page, (p) => PT.grab('cube', p), pad.pos);
    // Drop on the floor right beside the niche, at a guessed distance of 5.6 m (k = 2.8).
    let r = await run(page, () => { AP.walkTo(2.6, -2.9 + 5.6, 0.02); AP.aimAt(2.6, 0, -2.9); return AP.S().aim; });
    log('floor aim A', r);
    await run(page, () => { AP.act(); AP.tick(800); });
    await run(page, () => { AP.walkTo(0.9, 1.5, 0.05); AP.aimAt(1.3, 0.75, -3.6); });
    let s = await shot(page, 'p11a-floor-preview-k2.8');
    log('floor preview A', s.exhibits[0], s.stats);
    // Regrab from the floor at ~2 m and drop again beside the niche at k = 3/2.8 to reach 1.5 m.
    const e = s.exhibits[0];
    r = await run(page, (e) => { AP.walkTo(e.pos[0], e.pos[2] + 2.0, 0.02); AP.aimAt(e.pos[0], 0.5, e.pos[2]); AP.act(); AP.tick(100); return AP.S().carry; }, e);
    log('regrab A', r);
    const d2 = r.d1 * (3 / e.scale);
    r = await run(page, (d2) => { let z = -2.9 + d2; for (let i = 0; i < 6; i++) { AP.walkTo(2.6, z, 0.004); AP.aimAt(2.6, 0, -2.9); const dd = AP.S().aim.d; if (Math.abs(dd - d2) < 0.006) break; z += d2 - dd; } const a = AP.S().aim; AP.act(); AP.tick(800); return a; }, d2);
    log('floor aim B', r);
    await run(page, () => { AP.walkTo(0.9, 1.5, 0.05); AP.aimAt(1.3, 0.75, -3.6); });
    s = await shot(page, 'p11b-floor-preview-k3.0');
    log('floor preview B', s.exhibits[0], s.stats);
    // k = 1 transfer: grab at distance D, drop into the niche from distance D.
    const e2 = s.exhibits[0];
    r = await run(page, (e) => { AP.walkTo(e.pos[0] - 1.0, e.pos[2] + 3.0, 0.02); AP.aimAt(e.pos[0], 0.7, e.pos[2]); AP.act(); AP.tick(100); return AP.S().carry; }, e2);
    log('regrab B', r);
    r = await run(page, (d) => { AP.walkTo(0, -4.22 + d, 0.005); AP.aimAt(0, 0.75, -4.22); const a = AP.S().aim; AP.act(); AP.tick(1200); return a; }, r.d1);
    s = await shot(page, 'p11c-k1-transfer');
    log('k=1 transfer', r, s.targets[0].solved, s.stats);
    await run(page, () => { AP.walkTo(0, -3.0, 0.1); AP.key('KeyW', true); for (let i = 0; i < 40 && AP.S().phase !== 'won'; i++) AP.tick(100); AP.key('KeyW', false); AP.tick(1200); });
    s = await S(page);
    log('floor-preview result', s.phase, s.stars, s.stats);
    await ctx.close();
  },
  // 5c: walking into the exit before solving (L2, exit on the floor).
  async exitfirst() {
    const lv = L(2);
    const { ctx, page } = await level(2);
    const s = await run(page, (e) => { AP.walkTo(e[0], e[2], 0.2); AP.tick(1000); return AP.S(); }, lv.exit.pos);
    await shot(page, 'p12-l2-exit-before-solve');
    log('exit before solve', s.phase, s.player, s.exitOpen, await hudText(page));
    await ctx.close();
  },
  // 5d: hide vs. getting caught — how long does each take (game seconds) until play resumes?
  async hidetiming() {
    for (const mode of ['hide', 'caught']) {
      const lv = L(12), t = lv.targets[0], pad = lv.pads[0];
      const { ctx, page } = await level(12);
      const c = await run(page, (p) => PT.grab('painting', p), pad.pos);
      await run(page, (a) => PT.standFor(a.anchor, a.d2, a.dir, a.c), { anchor: t.anchor, d2: 9 * c.d1, dir: [0, 1], c: t.zone.c });
      const r = await run(page, (mode) => {
        AP.act(); let ms = 0;
        while (AP.S().phase !== 'chase' && ms < 10000) { AP.tick(50); ms += 50; }
        const alarmAt = ms;
        if (mode === 'hide') { const h = AP.S().hides[0]; const p0 = AP.S().player; AP.walkTo(h[0], h[1], 0.5); ms += Math.hypot(h[0] - p0.x, h[1] - p0.z) / 3.2 * 1000; }
        while (AP.S().phase !== 'explain' && ms < 60000) { AP.tick(100); ms += 100; }
        return { alarmAt, total: ms, stats: AP.S().stats, player: AP.S().player };
      }, mode);
      log(`hidetiming ${mode}`, r);
      results[`hidetiming-${mode}`] = r;
      await ctx.close();
    }
  },
  // 5e: finale guard — naive straight route while carrying, standing still in view, wall route.
  async finale() {
    const lv = L(18);
    const { ctx, page } = await level(18);
    let s = await shot(page, 'p13a-l18-start');
    // Grab the ladder, then walk straight across the middle toward the tower.
    const c = await run(page, (p) => PT.grab('ladder', p), lv.pads[0].pos);
    log('L18 carry', c);
    const r = await run(page, () => {
      const out = [];
      AP.face(4.5, -0.5);
      AP.key('KeyW', true);
      for (let i = 0; i < 60; i++) { AP.tick(100); const s = AP.S(); if (s.phase !== 'play') { out.push({ i, phase: s.phase, guard: s.guard, player: s.player, carry: s.carry }); break; } }
      AP.key('KeyW', false);
      return { out, s: AP.S() };
    });
    log('L18 straight route', JSON.stringify(r.out), r.s.phase, r.s.carry, r.s.exhibits.map((e) => e.id + ':' + e.state).join(','));
    s = await shot(page, 'p13b-l18-spotted');
    await run(page, () => { AP.tick(1500); });
    s = await shot(page, 'p13c-l18-chase');
    log('L18 chase', s.phase, s.guard, s.stats);
    await ctx.close();
    // Stand still in front of the guard: does it ever see you?
    const g = await level(18);
    const r2 = await run(g.page, () => {
      AP.walkTo(0, 7.5, 0.1); // walk toward the patrol square, stop
      const s0 = AP.S();
      AP.face(s0.guard.pos[0], s0.guard.pos[1]);
      for (let i = 0; i < 100; i++) AP.tick(100); // 10 s standing still
      const s1 = AP.S();
      return { before: { phase: s0.phase, guard: s0.guard }, after: { phase: s1.phase, guard: s1.guard, player: s1.player } };
    });
    log('L18 stand still 10 s', JSON.stringify(r2));
    await shot(g.page, 'p13d-l18-standstill');
    await g.ctx.close();
  },
  // 6: frame-rate feel (real-time, no advanceTime) on a heavy level.
  async fps() {
    for (const id of [1, 6, 12, 18]) {
      const { ctx, page } = await open(`?unlock=all&level=${id}`, { tag: `fps${id}` });
      await passTutorial(page);
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(800);
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(2500);
      await page.keyboard.up('ArrowLeft');
      await page.keyboard.up('KeyW');
      const f = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); let worst = 0; let last = t0; const step = (t) => { worst = Math.max(worst, t - last); last = t; if (++n < 120) requestAnimationFrame(step); else res({ fps: Math.round(n / ((t - t0) / 1000)), worstFrameMs: Math.round(worst) }); }; requestAnimationFrame(step); }));
      const st = await S(page);
      log(`fps L${id}`, f, 'hud fps', st.fps, 'moved to', st.player);
      await ctx.close();
    }
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
