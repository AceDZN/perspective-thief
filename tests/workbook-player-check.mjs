// Plays Perspective Thief inside the local math-games player (same-origin iframe from the R2
// release) and records the bridge messages the page receives. Run the acedzn-tools math-games app
// on :4215 with NEXT_PUBLIC_WORKBOOK_ASSET_BASE_URL set first.
//   node tests/workbook-player-check.mjs <screenshotDir>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const host = 'http://localhost:4215';
const shots = process.argv[2];
const autopilot = readFileSync(new URL('./autopilot.js', import.meta.url), 'utf8');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
async function page(url, vw = { width: 1440, height: 900 }) {
  const p = await browser.newPage({ viewport: vw });
  p.on('pageerror', (e) => errors.push(`${url}: ${e.message}`));
  p.on('response', (r) => { if (r.status() >= 400 && r.url().includes('perspective-thief')) errors.push(`${r.status()} ${r.url()}`); });
  await p.addInitScript(() => { window.__msgs = []; window.addEventListener('message', (e) => { if (e.data?.source === 'workbook-game') window.__msgs.push(e.data); }); });
  await p.goto(host + url, { waitUntil: 'domcontentloaded' });
  return p;
}
// Home + game page.
const home = await page('/');
await home.waitForTimeout(2500);
await home.screenshot({ path: `${shots}/wb-home.png`, fullPage: false });
const card = await home.locator('a[href="/perspective-thief"]').count();
const detail = await page('/perspective-thief');
await detail.waitForTimeout(2500);
await detail.screenshot({ path: `${shots}/wb-detail.png` });
const levelLinks = await detail.locator('a[href^="/perspective-thief/play?level="]').count();
const lessonLinks = await detail.locator('a[href*="math.workbook.co.il/grade-8/chapter-6/"], a[href*="/grade-8/chapter-6/"]').count();
console.log({ homeCard: card, levelLinks, lessonLinks });
// Deep link to level 12, then a real level-1 win through keyboard input in the iframe.
for (const level of [12, 1]) {
  const p = await page(`/perspective-thief/play?level=${level}`);
  await p.waitForFunction(() => window.__msgs.some((m) => m.type === 'level-start'), null, { timeout: 90000 });
  const frame = p.frames().find((f) => f.url().includes('/play/perspective-thief/'));
  const st = JSON.parse(await frame.evaluate(() => window.render_game_to_text()));
  console.log(`level ${level}: iframe level ${st.level?.id ?? st.levelId ?? JSON.stringify(st).slice(0, 80)}`, (await p.evaluate(() => window.__msgs)).map((m) => `${m.type}${m.level ? ' ' + m.level : ''}`));
  if (level === 12) { await p.waitForTimeout(3500); await p.screenshot({ path: `${shots}/wb-player-12.png` }); }
  if (level === 1) {
    await frame.evaluate(autopilot);
    await frame.evaluate(() => { window.advanceTime(16); document.querySelector('#tutGo')?.click(); window.advanceTime(16);
      AP.walkTo(-2.5, 2); AP.aimAt(-2.5, 1.25, 0); AP.act(); AP.tick(200); AP.walkTo(0, 1.78); AP.aimAt(0, 0.8, -4.2); AP.act(); AP.tick(800);
      AP.key('KeyW', true); for (let i = 0; i < 60 && AP.S().phase !== 'won'; i++) AP.tick(100); AP.key('KeyW', false); AP.tick(300); });
    await p.waitForFunction(() => window.__msgs.some((m) => m.type === 'level-complete'), null, { timeout: 20000 });
    console.log('after win:', JSON.stringify((await p.evaluate(() => window.__msgs)).filter((m) => m.type === 'level-complete')));
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${shots}/wb-player-1-win.png` });
  }
  await p.close();
}
// Phone portrait.
const phone = await page('/perspective-thief/play?level=4', { width: 390, height: 844 });
await phone.waitForTimeout(9000);
await phone.screenshot({ path: `${shots}/wb-phone.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
