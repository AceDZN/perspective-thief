// UI checks: locked toast on the map, pause / mute / hint, mobile 390×844 (menu, intro,
// briefing, HUD, fail card, results), real-time frame rate.
//   node tests/playtest2/ui.mjs [part,...]
import { open, S, run, log, closeBrowser, consoleLog, saveJson, OUT } from './lib.mjs';
import { solveCurrent, cardText, INSTALL } from './helpers.mjs';

const parts = (process.argv[2] ?? 'toast,controls,mobile,fps').split(',');
const out = {};
const snap = (page, n) => page.screenshot({ path: `${OUT}/${n}.png` });
const vis = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { w: r.width, h: r.height, x: r.x, y: r.y, op: cs.opacity, vis: cs.visibility, rendered: !!e.offsetParent || cs.position === 'fixed', text: e.innerText }; }, sel);

if (parts.includes('toast')) {
  const { ctx, page } = await open('', { tag: 'toast' });
  await page.waitForTimeout(1200);
  await page.click('.node[data-id="5"]', { force: true });
  await page.waitForTimeout(250);
  out.lockedToast = await vis(page, '#toast');
  out.hudHidden = await page.evaluate(() => document.getElementById('hud').hidden);
  await snap(page, 'ui-locked-toast');
  log('locked toast', JSON.stringify(out.lockedToast), 'hud hidden', out.hudHidden);
  // Keyboard on the map: Enter starts the selected level.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  out.enterStarts = (await S(page)).mode;
  log('Enter on map ->', out.enterStarts);
  await ctx.close();
}

if (parts.includes('controls')) {
  const { ctx, page } = await open('?unlock=all&level=12', { tag: 'controls' });
  await page.evaluate(() => window.advanceTime(16));
  await page.waitForTimeout(200);
  if (await page.isVisible('#tutGo')) await page.click('#tutGo');
  // Hint via button.
  await page.click('#btnHint');
  await page.waitForTimeout(300);
  out.hint = await vis(page, '#hintBox');
  out.hintStars = (await S(page)).stats;
  await snap(page, 'ui-hint');
  // Second hint press: does it cost again / show more?
  await page.keyboard.press('KeyH');
  await page.waitForTimeout(200);
  out.hint2 = { box: (await vis(page, '#hintBox'))?.text, stats: (await S(page)).stats };
  log('hint', JSON.stringify(out.hint), JSON.stringify(out.hint2));
  // Pause with P; time frozen?
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(300);
  const p0 = (await S(page)).player;
  await page.keyboard.down('KeyW'); await page.evaluate(() => window.advanceTime(1000)); await page.keyboard.up('KeyW');
  const p1 = (await S(page)).player;
  out.pause = { paused: (await S(page)).paused, moved: Math.hypot(p1.x - p0.x, p1.z - p0.z), overlay: (await vis(page, '#overlay'))?.text };
  await snap(page, 'ui-pause');
  // Mute toggle inside pause.
  await page.click('#optMute');
  out.muteBtn = await page.evaluate(() => document.getElementById('btnMute').textContent);
  await page.click('#pResume');
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyM');
  out.muteAfterM = await page.evaluate(() => document.getElementById('btnMute').textContent);
  // Escape pauses too; button pause.
  await page.click('#btnPause');
  await page.waitForTimeout(200);
  out.pauseBtn = (await S(page)).paused;
  await page.click('#pResume');
  log('pause', JSON.stringify(out.pause), 'mute', out.muteBtn, out.muteAfterM, 'pauseBtn', out.pauseBtn);
  // Solve with hint used: stars 2 and the results text.
  const r = await solveCurrent(page, 'ui-hint-solve', { shots: true });
  out.hintSolve = { stars: r.stars, results: r.results };
  // Finale hint disabled.
  await ctx.close();
  const f = await open('?unlock=all&level=18', { tag: 'controls18' });
  await f.page.evaluate(() => window.advanceTime(16));
  await f.page.waitForTimeout(200);
  if (await f.page.isVisible('#tutGo')) await f.page.click('#tutGo');
  out.finaleHintDisabled = await f.page.evaluate(() => document.getElementById('btnHint').disabled);
  await f.page.keyboard.press('KeyH');
  await f.page.waitForTimeout(200);
  out.finaleHToast = await f.page.evaluate(() => document.getElementById('toast').innerText);
  await snap(f.page, 'ui-finale-hint');
  log('finale hint disabled', out.finaleHintDisabled, out.finaleHToast);
  await f.ctx.close();
}

async function touchDrag(page, x0, y0, x1, y1, steps = 8) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

if (parts.includes('mobile')) {
  const opts = { width: 390, height: 844, touch: true, tag: 'mobile' };
  const { ctx, page } = await open('', opts);
  await page.waitForTimeout(1500);
  await snap(page, 'm-00-menu');
  await page.tap('#btnContinue');
  await page.waitForTimeout(1300);
  await snap(page, 'm-01-intro');
  await page.tap('#intro').catch(async () => { await page.touchscreen.tap(200, 400); });
  await page.waitForTimeout(700);
  await snap(page, 'm-02-brief');
  out.mBrief = await vis(page, '#card');
  if (await page.isVisible('#tutGo')) await page.tap('#tutGo');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.advanceTime(16));
  await snap(page, 'm-03-hud');
  out.mHud = { act: await vis(page, '#tAct'), lens: await vis(page, '#lensHud'), panel: await vis(page, '#levelPanel'), stars: await vis(page, '#hudStars'), stick: await vis(page, '#stick'), prompt: await vis(page, '#prompt') };
  log('mobile hud', JSON.stringify(out.mHud));
  // Play L1 with keyboard autopilot (movement) but a real tap on the act button for grab/drop.
  const info = await page.evaluate(INSTALL);
  const st = info[0];
  await run(page, (s) => { PT2.go(s.pad[0], s.pad[1], 0.05); const ex = AP.S().exhibits.find((e) => e.id === s.ex); AP.aimAt(ex.pos[0], ex.pos[1] + 0.15, ex.pos[2]); }, st);
  await page.tap('#tAct'); await page.evaluate(() => window.advanceTime(100));
  out.mGrab = (await S(page)).carry;
  // Too big first (fail card on mobile), at 7.5 m.
  const stand = await page.evaluate((s) => PT2.standAt(s.tid, 7.5, s.stand), st);
  await run(page, (a) => PT2.aimTarget(a.s, a.p), { s: st, p: stand });
  await snap(page, 'm-04-aim');
  await page.tap('#tAct'); await page.evaluate(() => window.advanceTime(800));
  await page.evaluate(() => AP.tick(1500));
  await snap(page, 'm-05-chase');
  await run(page, () => PT2.resolve(true));
  await page.waitForTimeout(300);
  await snap(page, 'm-06-failcard');
  out.mFail = await vis(page, '#card');
  await page.tap('#failGo').catch(() => page.tap('#tAct'));
  await page.evaluate(() => window.advanceTime(100));
  // Look drag on the right half.
  const y0 = (await S(page)).player.yaw;
  await touchDrag(page, 300, 400, 220, 400);
  await page.evaluate(() => window.advanceTime(50));
  out.mLookDelta = (await S(page)).player.yaw - y0;
  // Correct solve.
  await run(page, (s) => { PT2.go(s.pad[0], s.pad[1], 0.05); const ex = AP.S().exhibits.find((e) => e.id === s.ex); AP.aimAt(ex.pos[0], ex.pos[1] + 0.15, ex.pos[2]); }, st);
  await page.tap('#tAct'); await page.evaluate(() => window.advanceTime(100));
  await run(page, (a) => PT2.aimTarget(a.s, a.p), { s: st, p: st.stand });
  await page.tap('#tAct'); await page.evaluate(() => window.advanceTime(1200));
  // Walk to the step: climb button visible?
  await run(page, () => { AP.walkTo(0, -3.3, 0.1); AP.face(0, -6); AP.tick(100); });
  out.mClimb = await vis(page, '#tClimb');
  await snap(page, 'm-07-climb');
  if (out.mClimb?.w) await page.tap('#tClimb').catch(() => {});
  await run(page, () => PT2.exit());
  await page.waitForTimeout(1700);
  await snap(page, 'm-08-results');
  out.mResults = await vis(page, '#card');
  log('mobile', JSON.stringify({ grab: out.mGrab, look: out.mLookDelta, climb: out.mClimb, fail: out.mFail?.h, results: out.mResults?.h }));
  // Pause overlay on mobile.
  await ctx.close();
  // Briefing for a dense hall (W3 level 12) and the finale on mobile.
  for (const id of [12, 18]) {
    const m = await open(`?unlock=all&level=${id}`, opts);
    await m.page.waitForTimeout(1300);
    await snap(m.page, `m-L${id}-intro`);
    await m.page.evaluate(() => window.advanceTime(16));
    await m.page.waitForTimeout(400);
    await snap(m.page, `m-L${id}-brief`);
    out[`mBrief${id}`] = await vis(m.page, '#card');
    if (await m.page.isVisible('#tutGo')) await m.page.tap('#tutGo');
    await m.page.waitForTimeout(200);
    await m.page.evaluate(() => window.advanceTime(16));
    await snap(m.page, `m-L${id}-hud`);
    await m.page.tap('#btnPause');
    await m.page.waitForTimeout(300);
    await snap(m.page, `m-L${id}-pause`);
    await m.ctx.close();
  }
}

if (parts.includes('fps')) {
  out.fps = {};
  for (const id of [1, 6, 12, 15, 18]) {
    const { ctx, page } = await open(`?unlock=all&level=${id}`, { tag: `fps${id}` });
    await page.waitForTimeout(4500); // let the intro play in real time
    if (await page.isVisible('#tutGo')) await page.click('#tutGo');
    // Real-time play: hold W + turn for 4 s, sample rAF intervals.
    const r = await page.evaluate(async () => {
      const ts = [];
      const key = (c, d) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c, bubbles: true }));
      key('KeyW', true); key('ArrowLeft', true);
      await new Promise((res) => { const t0 = performance.now(); const f = (t) => { ts.push(t); if (t - t0 < 4000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      key('KeyW', false); key('ArrowLeft', false);
      const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b);
      return { frames: d.length, fps: +(d.length / 4).toFixed(1), p50: +d[Math.floor(d.length / 2)].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), max: +d[d.length - 1].toFixed(1) };
    });
    out.fps[id] = r;
    log(`fps L${id}`, JSON.stringify(r));
    await ctx.close();
  }
}

saveJson(`ui-${parts.join('_')}`, out);
log('console:', consoleLog.length ? consoleLog : 'none');
await closeBrowser();
