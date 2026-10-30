// Scenario 1: a brand-new player (empty localStorage) — menu → level 1 → tutorial → grab → drop → climb → exit.
import { retry, open, S, run, shot, passTutorial, cardText, hudText, log, closeBrowser, consoleLog, OUT } from './lib.mjs';

await retry('first30', async () => {
  const { ctx, page } = await open('', { tag: 'first30' });
  await page.waitForTimeout(1500);
  let s = await shot(page, 'p01-menu-fresh');
  log('menu state', s);
  log('menu continue button:', await page.innerText('#btnContinue'));
  log('menu level card:', (await page.innerText('#levelCard')).replace(/\s+/g, ' '));
  // Try clicking a locked node (level 5).
  await page.click('#nodes button[data-id="5"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/p01b-menu-locked-click.png` });
  log('after locked click toast:', await page.evaluate(() => document.getElementById('toast')?.innerText));
  log('locked node classes', await page.evaluate(() => [...document.querySelectorAll('#nodes button')].map((b) => b.className).join(',')));

  await page.click('#btnContinue');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/p01c-tutorial.png` });
  log('tutorial card:', await cardText(page));
  await passTutorial(page);
  await page.waitForTimeout(600);
  s = await shot(page, 'p01d-spawn-view');
  log('spawn hud', await hudText(page));
  log('spawn', s.player, 'aim', s.aim);

  // Look around like a new player: turn left 90° then right.
  await run(page, () => { AP.turnTo(Math.PI / 2); });
  await shot(page, 'p01e-look-left');
  await run(page, () => { AP.turnTo(-Math.PI / 2); });
  await shot(page, 'p01f-look-right');
  // Look at the niche / ledge straight ahead, slightly up.
  await run(page, () => { AP.turnTo(0); AP.pitchTo(0.15); });
  await shot(page, 'p01g-ledge-ahead');
  log('hud looking ahead', await hudText(page));

  // Walk to the cube without using the pad first: aim at it from the spawn.
  await run(page, () => { AP.aimAt(-2.5, 1.25, 0); });
  s = await shot(page, 'p01h-aim-cube-from-spawn');
  log('aim from spawn', s.aim, await hudText(page));
  // Go stand near the cube to read the placard.
  await run(page, () => { AP.walkTo(-2.5, 1.4); AP.aimAt(-2.5, 0.8, 0); });
  await shot(page, 'p01i-read-placard');
  // The pad.
  await run(page, () => { AP.walkTo(-2.5, 2.0); AP.aimAt(-2.5, 1.25, 0); });
  s = await shot(page, 'p01j-on-pad');
  log('on pad hud', await hudText(page));
  await run(page, () => { AP.act(); AP.tick(200); });
  s = await shot(page, 'p01k-grabbed');
  log('grabbed', s.carry, await hudText(page));
  // Walk toward the niche aiming at it; screenshots at d = 4.5, 6, 7.5 to see whether the held cube previews the size.
  for (const d of [4.5, 6, 7.5]) {
    await run(page, (d) => { const z = -4.22 + d; AP.walkTo(0, z, 0.02); AP.aimAt(0, 0.75, -4.22); }, d);
    s = await shot(page, `p01l-aim-niche-d${d}`);
    log(`aim niche at ${d}`, s.aim, await hudText(page));
  }
  // Floor rings: look down at 6 m.
  await run(page, () => { AP.walkTo(0, 1.78, 0.02); AP.turnTo(0); AP.pitchTo(-1.2); });
  await shot(page, 'p01m-floor-ring-6m');
  await run(page, () => { AP.aimAt(0, 0.75, -4.22); AP.act(); AP.tick(300); });
  await shot(page, 'p01n-whoosh');
  await run(page, () => { AP.tick(900); });
  s = await shot(page, 'p01o-fit');
  log('after drop', s.phase, s.targets, s.exitOpen, await hudText(page));
  // Climb: walk to the niche and press Space; then onto the ledge.
  await run(page, () => { AP.walkTo(0, -3.0, 0.1); AP.turnTo(0); AP.pitchTo(0); });
  await shot(page, 'p01p-at-step');
  await run(page, () => { AP.press('Space'); AP.tick(300); });
  s = await shot(page, 'p01q-climbed-1');
  log('after climb1', s.player);
  await run(page, () => { AP.key('KeyW', true); AP.tick(400); AP.key('KeyW', false); AP.press('Space'); AP.tick(300); });
  s = await shot(page, 'p01r-climbed-2');
  log('after climb2', s.player, s.phase);
  await run(page, () => { AP.key('KeyW', true); for (let i = 0; i < 40 && AP.S().phase !== 'won'; i++) AP.tick(100); AP.key('KeyW', false); AP.tick(1500); });
  await page.waitForTimeout(1500);
  s = await shot(page, 'p01s-won');
  log('final', s.phase, s.stars, s.stats, s.player, 'card:', await cardText(page));
  // Back to the map via the win card, check stars saved and level 2 unlocked.
  const mapBtn = await page.$('#winMap');
  if (mapBtn) { await mapBtn.click(); await page.waitForTimeout(1200); }
  s = await shot(page, 'p01t-menu-after-win');
  log('menu after win', s);
  const storage = await ctx.storageState();
  await ctx.close();
  // Reload in a fresh page with the same storage: are stars persisted?
  const { ctx: c2, page: p2 } = await open('', { storage, tag: 'first30-reload' });
  await p2.waitForTimeout(1200);
  s = await shot(p2, 'p01u-menu-reload');
  log('menu after reload', s);
  await c2.close();

});
log('console:', consoleLog);
await closeBrowser();
