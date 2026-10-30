// Look at the finale guard while it chases (pitch 0) to check its pose/animation.
import { retry, open, S, run, shot, passTutorial, log, closeBrowser, consoleLog } from './lib.mjs';
await retry('guardlook', async () => {
  const { ctx, page } = await open('?unlock=all&level=18', { tag: 'guardlook' });
  await passTutorial(page);
  await run(page, () => { AP.walkTo(0, 8, 0.1); AP.key('KeyW', true); for (let i = 0; i < 80 && AP.S().phase === 'play'; i++) { const g = AP.S().guard.pos; AP.key('KeyW', false); AP.face(g[0], g[1]); AP.key('KeyW', true); AP.tick(100); } AP.key('KeyW', false); const s = AP.S(); AP.key('KeyS', true); AP.tick(900); AP.key('KeyS', false); });
  for (let i = 0; i < 4; i++) {
    await run(page, () => { const s = AP.S(); AP.face(s.guard.pos[0], s.guard.pos[1]); AP.pitchTo(-0.15); AP.tick(200); });
    const s = await shot(page, `p13e-l18-guard-chase-${i}`);
    log('guardlook', i, s.phase, s.guard, s.player);
  }
  await ctx.close();
});
log('console', consoleLog); await closeBrowser();
