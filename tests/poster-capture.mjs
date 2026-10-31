// Poster candidates for the workbook games host: real gameplay frames at 1600 × 900, driven by
// keyboard events only (tests/autopilot.js). Needs the dev server.
//   node tests/poster-capture.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const base = process.argv[2] ?? 'http://localhost:5214/';
const out = process.argv[3] ?? 'test-output/poster';
mkdirSync(out, { recursive: true });
const autopilot = readFileSync(new URL('./autopilot.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
async function aimShot(id, name) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(`${base}?unlock=all&level=${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).mode !== 'loading', null, { timeout: 60000 });
  await page.evaluate(autopilot);
  await page.evaluate(() => { window.advanceTime(16); document.querySelector('#tutGo')?.click(); window.advanceTime(16); });
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
    window.advanceTime(16);
  }, id);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.close();
}
for (const id of [1, 2, 6, 12, 14]) await aimShot(id, `poster-${id}`);
await browser.close();
