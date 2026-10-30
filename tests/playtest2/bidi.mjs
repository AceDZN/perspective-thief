// Bidi check: renders every level's skill/objective/hint string the way the win card and HUD do
// (an RTL card, the game's own stylesheet) in a throwaway element and screenshots it. Diagnostic only;
// it does not touch game state.
import { open, closeBrowser, OUT } from './lib.mjs';
const { ctx, page } = await open('?unlock=all&level=1', { tag: 'bidi' });
await page.evaluate(() => window.advanceTime(16));
const rows = await page.evaluate(async () => {
  const { LEVELS, WORLDS } = await import('/src/levels.ts');
  const div = document.createElement('div');
  div.id = 'bidiProbe';
  div.className = 'card win';
  div.dir = 'rtl';
  div.style.cssText = 'position:fixed;inset:0;overflow:auto;z-index:99999;background:#111;padding:8px;max-width:none;width:auto;transform:none;';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/⟦/g, '<bdi dir="ltr">').replace(/⟧/g, '</bdi>');
  div.innerHTML = LEVELS.map((l) => `<p class="skill" style="margin:2px 0">${l.id} · ${esc(l.skill)}</p>`).join('') + (WORLDS ?? []).map((w) => `<p class="skill" style="margin:2px 0">W${w.id} · ${(w.intro ?? []).map(esc).join(' | ')}</p>`).join('');
  document.body.appendChild(div);
  return LEVELS.map((l) => l.skill);
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/bidi-skills.png` });
console.log(rows.join('\n'));
await ctx.close();
await closeBrowser();
