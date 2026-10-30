// L15: after a failed drop, can the pentagon be grabbed again from its pad?
import { retry, open, S, run, shot, passTutorial, log, closeBrowser, consoleLog } from './lib.mjs';
await retry('l15regrab', async () => {
  const { ctx, page } = await open('?unlock=all&level=15', { tag: 'l15' });
  await passTutorial(page);
  const r = await run(page, () => {
    const out = [];
    const grab = () => { AP.walkTo(-2, 2.3, 0.03); const e = AP.S().exhibits.find((x) => x.id === 'penta'); AP.aimAt(e.pos[0], e.pos[1] + 0.15, e.pos[2]); out.push({ aim: AP.S().aim, ex: e, player: AP.S().player }); AP.act(); AP.tick(120); return AP.S().carry; };
    out.push({ c1: grab() });
    AP.walkTo(0, -4.5 + 0.8, 0.02); AP.aimAt(0, 1.3, -4.5); AP.act();
    for (let i = 0; i < 60 && AP.S().phase !== 'explain'; i++) AP.tick(100);
    out.push({ phase: AP.S().phase }); AP.act(); AP.tick(50);
    out.push({ c2: grab() });
    return out;
  });
  log('l15 regrab', JSON.stringify(r));
  await shot(page, 'p14-l15-regrab');
  await ctx.close();
});
await closeBrowser();
