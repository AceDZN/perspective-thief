// Menu flow as a fresh player (no ?unlock): locks, tiers, next-level progression through the
// win card, clearing World 1, replay, the hall's challenge (★) node, generated rooms.
//   node tests/playtest2/flow.mjs
import { open, S, log, closeBrowser, consoleLog, saveJson, OUT } from './lib.mjs';
import { solveCurrent, cardText } from './helpers.mjs';

const out = {};
const snap = (page, n) => page.screenshot({ path: `${OUT}/${n}.png` });
const menuState = (page) => page.evaluate(() => ({
  state: JSON.parse(window.render_game_to_text()),
  cont: document.getElementById('btnContinue')?.innerText,
  card: document.getElementById('levelCard')?.innerText.replace(/\s+/g, ' '),
  nodes: [...document.querySelectorAll('#nodes .node')].map((n) => `${n.dataset.id ?? '★' + n.dataset.challenge}:${n.className.replace('node', '').trim()}:${n.innerText.replace(/\s+/g, ' ')}`),
  halls: [...document.querySelectorAll('#halls .hall')].map((h) => h.innerText.replace(/\s+/g, ' ')),
  toast: document.getElementById('toast')?.innerText,
}));

/** From a fresh level start (intro running in real time): screenshot the intro, skip it with a key, handle briefing. */
async function throughIntro(page, tag) {
  await page.waitForTimeout(1300);
  await snap(page, `${tag}-intro`);
  const introVisible = await page.isVisible('#intro');
  await page.keyboard.press('KeyX'); // any key skips
  await page.waitForTimeout(600);
  const brief = await cardText(page);
  if (brief) await snap(page, `${tag}-brief`);
  if (await page.$('#tutGo') && await page.isVisible('#tutGo')) await page.click('#tutGo');
  await page.evaluate(() => window.advanceTime(16));
  return { introVisible, brief };
}

const { ctx, page } = await open('', { tag: 'flow' });
await page.waitForTimeout(1500);
await snap(page, 'flow-00-menu-fresh');
out.fresh = await menuState(page);
log('fresh menu', JSON.stringify(out.fresh));
// Locked node.
await page.click('.node[data-id="3"]', { force: true });
await page.waitForTimeout(200);
out.lockedToast = (await menuState(page)).toast;
await snap(page, 'flow-01-locked-click');
log('locked toast:', out.lockedToast);
// Continue into level 1.
await page.click('#btnContinue');
out.levels = [];
for (let id = 1; id <= 5; id++) {
  const it = await throughIntro(page, `flow-L${id}`);
  const r = await solveCurrent(page, `flow-L${id}`, { shots: id === 1 || id === 5 });
  out.levels.push({ id, intro: it, phase: r.phase, stars: r.stars, results: r.results });
  log(`flow L${id}: ${r.phase} ${r.stars}★ results: ${r.results}`);
  if (id < 5) {
    if (!await page.$('#winNext')) { log('NO winNext on', id); break; }
    await page.click('#winNext');
  }
}
await snap(page, 'flow-L5-wincard');
out.l5card = await cardText(page);
await page.click('#winMap');
await page.waitForTimeout(1500);
await snap(page, 'flow-10-menu-after-w1');
out.afterW1 = await menuState(page);
log('menu after W1', JSON.stringify(out.afterW1));
// Replay level 1 from the map.
await page.click('.node[data-id="1"]', { force: true });
await page.waitForTimeout(400);
out.replaySel = await menuState(page);
await snap(page, 'flow-11-select-l1');
log('select L1 for replay:', out.replaySel.cont, '|', out.replaySel.card);
await page.click('#btnContinue');
await throughIntro(page, 'flow-replay1');
// Deliberately worse replay (one miss) to check stars are kept at max.
const r1 = await solveCurrent(page, 'flow-replay1', { shots: false });
out.replay = { stars: r1.stars, results: r1.results };
await page.click('#winMap');
await page.waitForTimeout(1200);
out.afterReplay = await menuState(page);
log('after replay', out.afterReplay.cont, JSON.stringify(out.afterReplay.state));
// Challenge node for World 1.
const ch = await page.$('.node.challenge[data-challenge="1"]');
out.challengeNode = !!ch;
if (ch) {
  await ch.click({ force: true });
  const it = await throughIntro(page, 'flow-ch1');
  const lvl = await S(page);
  out.ch1 = { intro: it, title: lvl.level.title, objective: lvl.level.objective, exhibits: lvl.exhibits.map((e) => e.placard), targets: lvl.targets.map((t) => t.plate), pads: lvl.pads };
  await page.evaluate(async () => { const t = JSON.parse(window.render_game_to_text()).targets[0]; AP.aimAt(...window.__pt.sim.level.targets[0].zone.c); });
  await snap(page, 'flow-ch1-spawn');
  const r = await solveCurrent(page, 'flow-ch1');
  out.ch1.result = { phase: r.phase, stars: r.stars, steps: r.steps, results: r.results };
  log('challenge 1:', JSON.stringify(out.ch1));
  const more = await page.$('#winMore');
  if (more) {
    await more.click();
    await throughIntro(page, 'flow-ch1b');
    const lvl2 = await S(page);
    const r2 = await solveCurrent(page, 'flow-ch1b');
    out.ch1b = { title: lvl2.level.title, objective: lvl2.level.objective, exhibits: lvl2.exhibits.map((e) => e.placard), targets: lvl2.targets.map((t) => t.plate), phase: r2.phase, stars: r2.stars, steps: r2.steps };
    log('challenge 1b:', JSON.stringify(out.ch1b));
  }
  await page.click('#winMap').catch(() => {});
  await page.waitForTimeout(1200);
  await snap(page, 'flow-12-menu-after-challenge');
  out.afterCh = await menuState(page);
  log('after challenge', JSON.stringify(out.afterCh.nodes));
}
// Reload persists?
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).mode === 'menu', null, { timeout: 60000 });
await page.waitForTimeout(800);
out.afterReload = await menuState(page);
log('after reload', out.afterReload.cont, JSON.stringify(out.afterReload.state));
await snap(page, 'flow-13-menu-reload');
saveJson('flow', out);
log('console:', consoleLog.length ? consoleLog : 'none');
await ctx.close();
await closeBrowser();
