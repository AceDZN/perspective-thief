// Real gameplay captures: plays scenarios in headless Chromium through keyboard events only
// (tests/autopilot.js) and saves screenshots + render_game_to_text state.
//   node tests/browser-capture.mjs [baseUrl] [outDir] [scenario,...]
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5214/';
const out = process.argv[3] ?? 'test-output/captures';
const only = process.argv[4]?.split(',');
mkdirSync(out, { recursive: true });
const autopilot = readFileSync(new URL('./autopilot.js', import.meta.url), 'utf8');

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
const results = {};

async function open(level, { width = 1280, height = 720, touch = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[L${level}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[L${level}] ${e.message}`));
  await page.goto(`${base}?unlock=all${level ? `&level=${level}` : ''}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).mode !== 'loading', null, { timeout: 60000 });
  await page.evaluate(autopilot);
  await page.evaluate(() => { window.advanceTime(16); document.querySelector('#tutGo')?.click(); window.advanceTime(16); });
  return { ctx, page };
}
async function shot(page, name) {
  await page.evaluate(() => window.advanceTime(16));
  await page.screenshot({ path: `${out}/${name}.png` });
  results[name] = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}
const run = (fn) => (page) => page.evaluate(fn);

const scenarios = {
  async menu() {
    const { ctx, page } = await open(0);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/00-menu.png` });
    results.menu = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    await ctx.close();
  },
  async first30() {
    const { ctx, page } = await open(1);
    await run(() => { AP.walkTo(-1.2, 3.9); AP.aimAt(-2.5, 1.1, 0); })(page);
    await shot(page, '01-first-30s');
    await run(() => { AP.walkTo(-2.5, 2); AP.aimAt(-2.5, 1.25, 0); AP.act(); AP.tick(200); })(page);
    await shot(page, '01b-grabbed');
    await run(() => { AP.walkTo(0, 1.78); AP.aimAt(0, 0.8, -4.2); })(page);
    await shot(page, '01c-aim-6m');
    await run(() => { AP.act(); AP.tick(800); })(page);
    await shot(page, '01d-fit');
    await run(() => { AP.key('KeyW', true); for (let i = 0; i < 60 && AP.S().phase !== 'won'; i++) AP.tick(100); AP.key('KeyW', false); AP.tick(1200); })(page);
    await shot(page, '01e-won');
    await ctx.close();
  },
  async carry() {
    const { ctx, page } = await open(2);
    await run(() => { AP.walkTo(-3, 2.5); AP.aimAt(-3, 1.5, -5.5); AP.act(); AP.tick(200); AP.walkTo(1.2, 5.6); AP.aimAt(5.5, 0.4, 4); })(page);
    await shot(page, '02-core-carry');
    await ctx.close();
  },
  async crash() {
    const { ctx, page } = await open(12);
    await run(() => { AP.walkTo(3.5, 3.7); AP.aimAt(3.5, 1.2, 2.5); AP.act(); AP.tick(100); AP.walkTo(0, 4.85); AP.aimAt(0, 1.6, -5.7); AP.act(); AP.tick(300); AP.tick(250); AP.tick(250); })(page);
    await shot(page, '03-failure-crash');
    await run(() => { AP.turnTo(-1.0); AP.pitchTo(0.02); for (let i = 0; i < 40 && AP.S().phase !== 'chase'; i++) AP.tick(100); AP.tick(1100); })(page);
    await shot(page, '03b-guard-chase');
    await run(() => { const h = AP.S().hides[0]; AP.walkTo(h[0], h[1], 0.5); AP.tick(600); })(page);
    await shot(page, '03c-hidden');
    await run(() => { for (let i = 0; i < 40 && AP.S().phase !== 'explain'; i++) AP.tick(250); })(page);
    await shot(page, '03d-worked-ratio');
    await ctx.close();
  },
  async shadows() {
    const { ctx, page } = await open(6);
    await run(() => { AP.walkTo(0, 5); AP.aimAt(0, 0.5, -3); })(page);
    await shot(page, '06-shadows');
    await ctx.close();
  },
  async rooftop() {
    const { ctx, page } = await open(18);
    await run(() => { AP.walkTo(0, 8); AP.aimAt(5, 2, -6); })(page);
    await shot(page, '18-rooftop');
    await ctx.close();
  },
  async ruler() {
    const { ctx, page } = await open(1);
    await run(() => { AP.walkTo(0.3, 1.78); AP.turnTo(0); AP.pitchTo(-1.25); })(page);
    await shot(page, 'debug-ruler-6m');
    await ctx.close();
  },
  async solveAll() {
    // Every level, start to finish, through keyboard events only. Waypoints avoid obstacles.
    const WAY = { 9: [[1.5, 2.6]], 3: [[0, 1.0]] };
    const ids = (process.env.LEVELS ?? Array.from({ length: 18 }, (_, i) => i + 1).join(',')).split(',').map(Number);
    for (const id of ids) {
      const { ctx, page } = await open(id);
      const r = await page.evaluate(async ({ id, way }) => {
        const { plan } = await import('/src/solver.ts');
        const { levelById } = await import('/src/levels.ts');
        const L = levelById(id);
        const log = [];
        for (const st of plan(L)) {
          AP.walkTo(st.pad[0], st.pad[1]);
          const ex = AP.S().exhibits.find((e) => e.id === st.exId);
          const def = L.exhibits.find((e) => e.id === st.exId);
          AP.aimAt(def.pos[0], def.pedestal + 0.15, def.pos[1]);
          AP.act(); AP.tick(100);
          if (!AP.S().carry) { log.push(`no grab ${st.exId} aim=${JSON.stringify(AP.S().aim)}`); break; }
          if (st.target.orientation !== undefined) for (let i = 0; i < 3 && AP.S().exhibits.find((e) => e.id === st.exId).orientation !== st.target.orientation; i++) AP.press('KeyR');
          AP.walkTo(st.stand[0], st.stand[1], 0.02);
          AP.aimAt(...st.target.zone.c);
          const s1 = AP.S();
          log.push(`${st.target.id}: d1=${s1.carry?.d1} d=${s1.aim.d} want=${st.d2.toFixed(3)} aim=${s1.aim.kind}`);
          AP.act(); AP.tick(600); AP.tick(600);
          const s2 = AP.S();
          if (s2.phase !== 'play') { log.push(`after drop phase=${s2.phase} fail=${s2.failure?.kind}`); for (let i = 0; i < 60 && AP.S().phase !== 'play'; i++) { if (AP.S().phase === 'explain') AP.act(); AP.tick(250); } }
        }
        for (const w of way ?? []) AP.walkTo(w[0], w[1], 0.15);
        const e = L.exit.pos;
        AP.key('KeyW', true);
        for (let i = 0; i < 80 && AP.S().phase !== 'won'; i++) { const p = AP.S().player; const want = Math.atan2(-(e[0] - p.x), -(e[2] - p.z)); if (Math.abs(Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw))) > 0.25) { AP.key('KeyW', false); AP.face(e[0], e[2]); AP.key('KeyW', true); } AP.tick(100); }
        AP.key('KeyW', false); AP.tick(1200);
        const f = AP.S();
        return { phase: f.phase, stars: f.stars, stats: f.stats, solved: f.targets.map((t) => t.solved), player: f.player, log };
      }, { id, way: WAY[id] });
      results[`solve-${id}`] = r;
      console.log(id, r.phase, r.stars, JSON.stringify(r.solved), r.log.join(' | '));
      await page.screenshot({ path: `${out}/solve-${String(id).padStart(2, '0')}.png` });
      await ctx.close();
    }
  },
  async finale() {
    // Level 18 with a stealth route: keep > 5.5 m from the patrol square, stand on the far side.
    const { ctx, page } = await open(18);
    const r = await page.evaluate(async () => {
      const { levelById } = await import('/src/levels.ts');
      const L = levelById(18);
      const log = [];
      const go = (pts) => { for (const p of pts) AP.walkTo(p[0], p[1], 0.03); };
      const grab = (id) => { const d = L.exhibits.find((e) => e.id === id); const pad = L.pads.find((p) => p.forId === id); go([pad.pos]); AP.aimAt(d.pos[0], d.pedestal + 0.2, d.pos[1]); AP.act(); AP.tick(100); log.push(`grab ${id}: ${JSON.stringify(AP.S().carry)}`); };
      const drop = (tid, stand) => {
        const t = L.targets.find((x) => x.id === tid);
        const c = AP.S().carry;
        const k = { tower: 6, billboard: 3, loop: 2.5 }[tid];
        // Exact standing spot at k · d₁ along the chosen direction.
        const dx = stand[0] - t.anchor[0], dz = stand[1] - t.anchor[2], l = Math.hypot(dx, dz);
        const d2 = k * c.d1;
        AP.walkTo(t.anchor[0] + (dx / l) * d2, t.anchor[2] + (dz / l) * d2, 0.02);
        AP.aimAt(...t.zone.c);
        log.push(`${tid}: d=${AP.S().aim.d} aim=${AP.S().aim.kind} guard=${AP.S().guard.mode}`);
        AP.act(); AP.tick(700); AP.tick(700);
        log.push(`  -> ${AP.S().phase} solved=${AP.S().targets.find((x) => x.id === tid).solved}`);
      };
      grab('ladder');
      go([[-11, 9], [-11, -11], [2.25, -11.3]]);
      drop('tower', [2.25, -11.3]);
      go([[-11, -11], [-11, 10.6], [2, 10.6]]);
      grab('banner');
      go([[-11, 10.6], [-11, 2]]);
      drop('billboard', [-9.6, 2]);
      go([[-11, 10.6], [11, 11.3], [9, 11]]);
      grab('crate');
      go([[11, 11], [11, -11.3], [-7, -11.3]]);
      drop('loop', [-7, -9]);
      go([[-10.6, -10.6]]);
      AP.tick(1500);
      const f = AP.S();
      return { phase: f.phase, stars: f.stars, stats: f.stats, solved: f.targets.map((t) => t.solved), log };
    });
    results.finale = r;
    console.log('finale', r.phase, r.stars, JSON.stringify(r.solved), JSON.stringify(r.stats), '\n  ' + r.log.join('\n  '));
    await page.screenshot({ path: `${out}/solve-18.png` });
    await ctx.close();
  },
  async vent() {
    const { ctx, page } = await open(2);
    await run(() => { AP.walkTo(2.2, 5.2); AP.aimAt(5.5, 0.5, 4); })(page);
    await shot(page, 'debug-vent');
    await ctx.close();
  },
  async mobileMenu() {
    const { ctx, page } = await open(0, { width: 390, height: 844, touch: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/00-menu-mobile.png` });
    await ctx.close();
  },
  async starts() {
    // Spawn view of every level, looking at the first target, then aiming from the solver's stand while carrying.
    const ids = (process.env.LEVELS ?? Array.from({ length: 18 }, (_, i) => i + 1).join(',')).split(',').map(Number);
    for (const id of ids) {
      const { ctx, page } = await open(id);
      await page.evaluate(async (id) => {
        const { levelById } = await import('/src/levels.ts');
        const L = levelById(id);
        const t = L.targets[0];
        AP.aimAt(...t.zone.c);
      }, id);
      await shot(page, `start-${String(id).padStart(2, '0')}`);
      await page.evaluate(async (id) => {
        const { plan } = await import('/src/solver.ts');
        const { levelById } = await import('/src/levels.ts');
        const L = levelById(id);
        const st = plan(L)[0];
        const def = L.exhibits.find((e) => e.id === st.exId);
        AP.walkTo(st.pad[0], st.pad[1]);
        AP.aimAt(def.pos[0], def.pedestal + 0.2, def.pos[1]);
        AP.act(); AP.tick(100);
        AP.walkTo(st.stand[0], st.stand[1], 0.02);
        AP.aimAt(...st.target.zone.c);
      }, id);
      await shot(page, `aim-${String(id).padStart(2, '0')}`);
      await ctx.close();
    }
  },
  async pit() {
    const { ctx, page } = await open(3);
    await run(() => { AP.walkTo(0, 2.0); AP.turnTo(0); AP.pitchTo(-0.45); })(page);
    await shot(page, 'debug-pit');
    await ctx.close();
  },
  async intro() {
    for (const id of [1, 6]) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await ctx.newPage();
      await page.goto(`${base}?unlock=all&level=${id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).mode === 'play', null, { timeout: 60000 });
      await page.waitForTimeout(1600);
      await page.screenshot({ path: `${out}/intro-${id}.png` });
      await page.waitForTimeout(2600);
      await page.screenshot({ path: `${out}/briefing-${id}.png` });
      await ctx.close();
    }
  },
  async win() {
    const { ctx, page } = await open(1);
    await run(() => { AP.walkTo(-2.5, 2); AP.aimAt(-2.5, 1.25, 0); AP.act(); AP.tick(200); AP.walkTo(0, 1.78); AP.aimAt(0, 0.8, -4.2); AP.act(); AP.tick(800); AP.key('KeyW', true); for (let i = 0; i < 60 && AP.S().phase !== 'won'; i++) AP.tick(100); AP.key('KeyW', false); AP.tick(200); })(page);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}/win-1.png` });
    await ctx.close();
  },
  async shadow18() {
    const { ctx, page } = await open(18);
    await run(() => { AP.walkTo(11, 9, 0.2); AP.walkTo(11, 3.5, 0.2); AP.walkTo(8.6, 3.5, 0.1); AP.aimAt(7, 0, 6); })(page);
    await shot(page, 'debug-shadow18');
    await ctx.close();
  },
  async mobile() {
    const { ctx, page } = await open(1, { width: 390, height: 844, touch: true });
    await run(() => { AP.aimAt(-2.5, 1.1, 0); })(page);
    await shot(page, '01-mobile');
    await ctx.close();
  },
};

for (const [name, fn] of Object.entries(scenarios)) {
  if (only && !only.includes(name)) continue;
  try {
    await fn();
    console.log('ok', name);
  } catch (e) {
    console.log('FAIL', name, e.message);
    errors.push(`${name}: ${e.message}`);
  }
}
writeFileSync(`${out}/state.json`, JSON.stringify({ results, errors }, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
