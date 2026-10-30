// Frame-rate probe: lets the real requestAnimationFrame loop run (no advanceTime) and reads the
// game's own fps counter. Headless Chromium on this machine's GPU; not a phone measurement.
//   node tests/perf.mjs [baseUrl]
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5214/';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [w, h] of [[1280, 720], [1920, 1080]]) {
  for (const level of [1, 6, 12, 18]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${base}?unlock=all&level=${level}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).mode === 'play', null, { timeout: 60000 });
    await page.evaluate(() => document.querySelector('#tutGo')?.click());
    await page.waitForTimeout(4000);
    const s = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    console.log(`${w}x${h} level ${level}: ${s.fps} fps`);
    await page.close();
  }
}
await browser.close();
