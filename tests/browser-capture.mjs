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
  await page.evaluate(() => { document.querySelector('#tutGo')?.click(); window.advanceTime(16); });
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
    await run(() => { AP.walkTo(-3, 2.5); AP.aimAt(-3, 1.5, -5.5); AP.act(); AP.tick(200); AP.walkTo(3.55 - 0.2, 4 + 1.99); AP.aimAt(5.5, 0.45, 4); })(page);
    await shot(page, '02-core-carry');
    await ctx.close();
  },
  async crash() {
    const { ctx, page } = await open(12);
    await run(() => { AP.walkTo(3.5, 3.7); AP.aimAt(3.5, 1.2, 2.5); AP.act(); AP.tick(100); AP.walkTo(0, 4.85); AP.aimAt(0, 1.6, -5.7); AP.act(); AP.tick(300); AP.tick(250); AP.pitchTo(0.25); })(page);
    await shot(page, '03-failure-crash');
    await run(() => { AP.tick(1300); AP.tick(900); const g = AP.S().guard.pos; AP.face(g[0], g[1]); AP.pitchTo(0); })(page);
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
