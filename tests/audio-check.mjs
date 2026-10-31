// Audio probe: unlocks the synth, taps the master bus with an analyser and reports the level
// (RMS dBFS) for each hall's music + ambience, the chase layer, the heartbeat, and any errors.
// It proves the graph makes sound and doesn't throw; it cannot judge whether it sounds good.
//   node tests/audio-check.mjs [baseUrl]
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://localhost:5214/';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${base}?unlock=all`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__pt && window.render_game_to_text, null, { timeout: 60000 });
await page.evaluate(() => {
  const a = window.__pt.audio;
  a.unlock();
  const an = a.ctx.createAnalyser();
  an.fftSize = 2048;
  a.master.connect(an);
  window.__an = an;
});
const rms = () => page.evaluate(async () => {
  const an = window.__an, buf = new Float32Array(an.fftSize);
  let sum = 0, n = 0, peak = 0;
  for (let i = 0; i < 40; i++) {
    an.getFloatTimeDomainData(buf);
    for (const v of buf) { sum += v * v; n++; peak = Math.max(peak, Math.abs(v)); }
    await new Promise((r) => setTimeout(r, 50));
  }
  return { db: Math.round(10 * Math.log10(sum / n + 1e-12)), peak: Math.round(peak * 100) / 100 };
});
const out = {};
for (const theme of ['menu', 'lengths', 'shadows', 'canvas', 'vault', 'rooftop']) {
  await page.evaluate((t) => { window.__pt.audio.theme = t; }, theme);
  await page.waitForTimeout(1500);
  out[theme] = await rms();
}
await page.evaluate(() => window.__pt.audio.setMusicTension(true));
await page.waitForTimeout(800);
out.chase = await rms();
await page.evaluate(() => { const a = window.__pt.audio; a.setMusicTension(false); a.setMuted(true); });
await page.waitForTimeout(500);
out.muted = await rms();
await page.evaluate(() => { const a = window.__pt.audio; a.setMuted(false); a.theme = 'menu'; a.setDanger(1); });
await page.waitForTimeout(1500);
out.heartbeat = await rms();
await page.evaluate(() => { const a = window.__pt.audio; a.fit(); a.crash(); a.win(); a.grab(); a.alarm(true); });
await page.waitForTimeout(600);
out.sfx = await rms();
console.log(JSON.stringify(out, null, 1));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
