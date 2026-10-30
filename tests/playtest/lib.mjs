// Shared helpers for the independent playtest (tests/playtest/*.mjs).
// Drives the game only through real input: Playwright mouse/keyboard/touch for UI, and the
// keyboard-event autopilot (tests/autopilot.js) + window.advanceTime for movement. Never injects state.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';

export const BASE = process.env.BASE ?? 'http://localhost:5214/';
export const OUT = 'test-output/playtest';
mkdirSync(OUT, { recursive: true });
const autopilot = readFileSync(new URL('../autopilot.js', import.meta.url), 'utf8');

let browser;
export async function getBrowser() {
  browser ??= await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  return browser;
}
export async function closeBrowser() { await browser?.close(); browser = undefined; }

export const consoleLog = [];
export function log(...a) {
  const line = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  console.log(line);
  appendFileSync(`${OUT}/log.txt`, line + '\n');
}

/** Opens the game. query: e.g. '?unlock=all&level=12' or '' for a fresh player. */
export async function open(query, { width = 1280, height = 720, touch = false, storage = null, tag = '' } = {}) {
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, storageState: storage ?? undefined });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleLog.push(`[${tag || query}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => consoleLog.push(`[${tag || query}] pageerror: ${e.message}`));
  await page.goto(`${BASE}${query}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).mode !== 'loading' && !document.getElementById('loading'), null, { timeout: 90000 });
  await page.evaluate(autopilot);
  // The lead edits src/ while we play: a Vite full reload wipes the page. Detect it so the
  // scenario can be retried instead of reporting a bogus bug.
  page.__reloaded = false;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) page.__reloaded = true; });
  return { ctx, page };
}
export class Reloaded extends Error {}
/** Runs a scenario function up to `tries` times when a dev-server reload interrupts it. */
export async function retry(name, fn, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      if (/AP is not defined|Execution context was destroyed|Reloaded|render_game_to_text/.test(String(e?.message ?? e)) && i < tries - 1) { log(`[${name}] dev-server reload, retry ${i + 1}`); continue; }
      throw e;
    }
  }
}

export const S = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
export const run = async (page, fn, arg) => { if (page.__reloaded) throw new Reloaded('Reloaded'); const r = await page.evaluate(fn, arg); if (page.__reloaded) throw new Reloaded('Reloaded'); return r; };
export async function shot(page, name) {
  await page.evaluate(() => window.advanceTime(16)).catch(() => {});
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  return S(page);
}
/** Real click on the tutorial "go" button if it is showing. */
export async function passTutorial(page) {
  const go = await page.$('#tutGo');
  if (go && await go.isVisible()) { await go.click(); await page.waitForTimeout(50); }
}
export async function cardText(page) {
  return page.evaluate(() => { const c = document.getElementById('card'); return c && !c.hidden ? c.innerText.replace(/\s+/g, ' ').trim() : null; });
}
export async function hudText(page) {
  return page.evaluate(() => ({
    name: document.getElementById('lvlName')?.innerText, obj: document.getElementById('lvlObj')?.innerText,
    d1: document.getElementById('hudD1')?.innerText, d: document.getElementById('hudD')?.innerText,
    aim: document.getElementById('hudAim')?.innerText, prompt: document.getElementById('prompt')?.innerText,
    toast: document.getElementById('toast')?.innerText, hint: document.getElementById('hintBox')?.hidden ? null : document.getElementById('hintBox')?.innerText,
    stars: document.getElementById('hudStars')?.innerText,
  }));
}
export function saveJson(name, data) { writeFileSync(`${OUT}/${name}.json`, JSON.stringify(data, null, 1)); }
