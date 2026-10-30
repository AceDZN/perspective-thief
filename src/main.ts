import '@fontsource/rubik/400.css';
import '@fontsource/rubik/500.css';
import '@fontsource/rubik/700.css';
import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LEVELS, WORLDS, levelById, type Level } from './levels.ts';
import { EYE, NO_INPUT, Sim, type GameEvent, type Input } from './sim.ts';
import { starsFor, type ConsequenceKind } from './rules.ts';
import { localBounds } from './shapes.ts';
import { buildExhibitMesh, buildLevel, themeFog, type LevelView } from './world.ts';
import { Character, loadModels, modelInstance } from './models.ts';
import { Audio } from './audio.ts';
import { Controls } from './input.ts';
import { bidi, glowSprite } from './textures.ts';
import { buildMenu, type MenuView } from './menu.ts';
import { generateLevel } from './generator.ts';

// ─────────────── DOM ───────────────
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app');
const canvas = $<HTMLCanvasElement>('game');
const hud = $('hud');
const card = $('card');
const overlay = $('overlay');
const menuEl = $('menu');

/** Hebrew line with ⟦…⟧ → HTML with LTR-isolated math. */
function html(s: string, cls = ''): string {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return esc.replace(/⟦([^⟧]*)⟧/g, (_m, inner: string) => `<bdi dir="ltr"${cls ? ` class="${cls}"` : ''}>${inner}</bdi>`);
}
function starsHtml(n: number, of = 3): string {
  let s = '';
  for (let i = 0; i < of; i++) s += i < n ? '<span>★</span>' : '<span class="off">★</span>';
  return s;
}

// ─────────────── persistence ───────────────
const KEY = 'perspective-thief:v1';
const LEARN = 'perspective-thief:learn';
interface Save { stars: Record<number, number>; reduced: boolean; muted: boolean; current: number }
function loadSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { stars: s.stars ?? {}, reduced: !!s.reduced, muted: !!s.muted, current: s.current ?? 1 };
  } catch {
    return { stars: {}, reduced: false, muted: false, current: 1 };
  }
}
const save = loadSave();
function persist(): void {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode */ }
}
const params = new URLSearchParams(location.search);
const unlockAll = params.get('unlock') === 'all';
function unlocked(id: number): boolean {
  if (unlockAll || id === 1) return true;
  return (save.stars[id - 1] ?? 0) > 0 || (save.stars[id] ?? 0) > 0;
}
function totalStars(): number {
  return Object.values(save.stars).reduce((a, b) => a + b, 0);
}
let learnBuffer: unknown[] = [];
try { learnBuffer = JSON.parse(localStorage.getItem(LEARN) ?? '[]'); } catch { learnBuffer = []; }
function flushLearn(sim: Sim | null): void {
  if (!sim || !sim.log.length) return;
  learnBuffer.push(...sim.log.splice(0));
  learnBuffer = learnBuffer.slice(-1000);
  try { localStorage.setItem(LEARN, JSON.stringify(learnBuffer)); } catch { /* ignore */ }
}

// ─────────────── renderer ───────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.03, 400);
camera.rotation.order = 'YXZ';
const scene = new THREE.Scene();
const overlayScene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
scene.environmentIntensity = 0.22;
overlayScene.environment = envTex;
overlayScene.environmentIntensity = 0.3;
overlayScene.add(new THREE.HemisphereLight('#9fb4e8', '#2a1a10', 0.9));
const ovKey = new THREE.DirectionalLight('#ffe2b0', 1.1);
ovKey.position.set(1, 2, 1);
overlayScene.add(ovKey);

const composer = new EffectComposer(renderer);
const mainPass = new RenderPass(scene, camera);
composer.addPass(mainPass);
const overlayPass = new RenderPass(overlayScene, camera);
overlayPass.clear = false;
overlayPass.clearDepth = true;
composer.addPass(overlayPass);
const outline = new OutlinePass(new THREE.Vector2(512, 512), overlayScene, camera);
outline.visibleEdgeColor.set('#ffd25a');
outline.hiddenEdgeColor.set('#ffb020');
outline.edgeStrength = 4;
outline.edgeGlow = 0.8;
outline.edgeThickness = 2;
outline.pulsePeriod = 1.6;
composer.addPass(outline);
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.32, 0.4, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize(): void {
  const w = Math.max(1, app.clientWidth), h = Math.max(1, app.clientHeight);
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 82 : 70;
  camera.updateProjectionMatrix();
  if (menu) {
    menu.camera.aspect = w / h;
    menu.camera.updateProjectionMatrix();
  }
}
new ResizeObserver(resize).observe(app);

canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); paused = true; showToast('הגרפיקה נטענת מחדש…', 'bad'); });
canvas.addEventListener('webglcontextrestored', () => { paused = false; });

// ─────────────── game state ───────────────
const audio = new Audio();
audio.muted = save.muted;
const controls = new Controls(canvas, $('stick'), $('knob'));
let mode: 'loading' | 'menu' | 'play' = 'loading';
let menu: MenuView | null = null;
let selected = save.current;
let sim: Sim | null = null;
let view: LevelView | null = null;
let level: Level | null = null;
let paused = false;
let manual = false;
let acc = 0;
let cardKind: '' | 'tutorial' | 'fail' | 'win' = '';
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
let reduced = save.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;
document.body.classList.toggle('reduced', reduced);
const STEP = 1 / 60;

// FX state
let shake = 0;
let camY = 0;
let viewBob = 0;
const exOrient = new Map<string, number>();
let successGlow: { exId: string; t: number } | null = null;
let raccoonShow: { pos: THREE.Vector3; t: number } | null = null;
let consequenceFx: ConsequenceKind | null = null;
let lastPhase = '';
const solvedLaserOff = new Set<string>();

// Overlay objects: view model (gloved hand + lens) and held-object holder.
const viewModel = new THREE.Group();
overlayScene.add(viewModel);
let lensModel: THREE.Group | null = null;
const holder = new THREE.Group();
overlayScene.add(holder);
const sparkles = makeSparkles();
overlayScene.add(sparkles);
const worldFx = new THREE.Group();
scene.add(worldFx);
const aimDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#ff2a2a'), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
aimDot.scale.setScalar(0.22);
aimDot.renderOrder = 10;
scene.add(aimDot);
const aimLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const aimLine = new THREE.Line(aimLineGeo, new THREE.LineBasicMaterial({ color: '#ff3030', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
aimLine.frustumCulled = false;
scene.add(aimLine);

function buildViewModel(): void {
  viewModel.clear();
  // Tripo "gloved hand holding a brass lens" (glass faces +z in the file, so turn it around).
  lensModel = modelInstance('lensHand', 0.16);
  const inner = new THREE.Group();
  inner.add(lensModel);
  lensModel.position.y -= 0.1;
  inner.rotation.y = Math.PI;
  viewModel.add(inner);
}

function makeSparkles(): THREE.Points {
  const n = 60;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowSprite('#ffe08a'), size: 0.04, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffd36a' }));
  pts.frustumCulled = false;
  pts.userData.seeds = Array.from({ length: n }, () => [Math.random() * Math.PI * 2, Math.random() * 2 - 1, Math.random()]);
  return pts;
}

// Burst particles in the world (shards, gold sparks, dust).
interface Burst { pts: THREE.Points; vel: Float32Array; t: number; life: number; gravity: number }
const bursts: Burst[] = [];
function burst(at: THREE.Vector3, color: string, n: number, speed: number, size: number, gravity = 6, life = 1.4): void {
  if (reduced) n = Math.ceil(n / 3);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = at.x; pos[i * 3 + 1] = at.y; pos[i * 3 + 2] = at.z;
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI;
    const s = speed * (0.3 + Math.random() * 0.7);
    vel[i * 3] = Math.cos(th) * Math.sin(ph) * s;
    vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * s + speed * 0.3;
    vel[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * s;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowSprite(color), color, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false;
  worldFx.add(pts);
  bursts.push({ pts, vel, t: 0, life, gravity });
}
// Falling chunks (plaster, glass, wood) for crashes.
interface Chunk { m: THREE.Mesh; v: THREE.Vector3; w: THREE.Vector3; t: number }
const chunks: Chunk[] = [];
const chunkMats = [new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: '#bfe3ff', roughness: 0.05, transparent: true, opacity: 0.6 }), new THREE.MeshStandardMaterial({ color: '#7a5a32', roughness: 0.8 })];
function debris(at: THREE.Vector3, n: number): void {
  if (reduced) n = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const s = 0.08 + Math.random() * 0.25;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.4, s * (0.5 + Math.random())), chunkMats[i % 3]);
    m.castShadow = true;
    m.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 0.5, (Math.random() - 0.5) * 2));
    worldFx.add(m);
    chunks.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4), w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), t: 0 });
  }
}
function updateChunks(dt: number): void {
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i];
    c.t += dt;
    c.v.y -= 12 * dt;
    c.m.position.addScaledVector(c.v, dt);
    if (c.m.position.y < 0.05) { c.m.position.y = 0.05; c.v.multiplyScalar(0.4); c.v.y = Math.abs(c.v.y) * 0.3; c.w.multiplyScalar(0.5); }
    c.m.rotation.x += c.w.x * dt; c.m.rotation.y += c.w.y * dt; c.m.rotation.z += c.w.z * dt;
    if (c.t > 4) { worldFx.remove(c.m); c.m.geometry.dispose(); chunks.splice(i, 1); }
  }
}
function updateBursts(dt: number): void {
  updateChunks(dt);
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.t += dt;
    const p = b.pts.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let j = 0; j < p.count; j++) {
      b.vel[j * 3 + 1] -= b.gravity * dt;
      p.setXYZ(j, p.getX(j) + b.vel[j * 3] * dt, Math.max(0.02, p.getY(j) + b.vel[j * 3 + 1] * dt), p.getZ(j) + b.vel[j * 3 + 2] * dt);
    }
    p.needsUpdate = true;
    (b.pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - b.t / b.life);
    if (b.t > b.life) {
      worldFx.remove(b.pts);
      b.pts.geometry.dispose();
      bursts.splice(i, 1);
    }
  }
}

// ─────────────── HUD helpers ───────────────
let toastTimer = 0;
function showToast(text: string, kind: '' | 'good' | 'bad' = '', ms = 1800): void {
  const t = $('toast');
  t.innerHTML = html(text);
  t.className = 'show ' + kind;
  toastTimer = ms / 1000;
}
const FAIL_TITLE: Record<ConsequenceKind, string> = {
  crash: 'קראש! גדול מדי',
  roofCrash: 'דרך הגג! ענק מדי',
  fallThrough: 'נפל פנימה — קטן מדי',
  blownAway: 'המאוורר העיף אותו — קטן מדי',
  pocketed: 'השומר הכניס אותו לכיס — קטן מדי',
  tooShort: 'קצר מדי!',
  gapLeft: 'נשאר רווח — קטן מדי',
  jam: 'נתקע! הצלעות לא מתאימות',
  noFit: 'לא נכנס — הצורה לא דומה',
};

function showCard(kind: typeof cardKind, inner: string): void {
  cardKind = kind;
  card.className = 'card ' + kind;
  card.innerHTML = inner;
  card.hidden = false;
  if (document.pointerLockElement) document.exitPointerLock();
  const btn = card.querySelector<HTMLButtonElement>('button.primary, button');
  btn?.focus({ preventScroll: true });
}
function hideCard(): void {
  card.hidden = true;
  cardKind = '';
  controls.clear();
}

function showTutorial(l: Level): void {
  const lines = (l.tutorial ?? []).map((t) => `<p class="math">${html(t)}</p>`).join('');
  const ext = l.extension ? '<p class="stats">הרחבה — מעבר לתוכנית הליבה</p>' : '';
  showCard('tutorial', `<div class="tut"><h2>${html(l.title)}</h2>${ext}${lines}</div><div class="row"><button class="btn primary" id="tutGo">יאללה לשדוד</button></div>`);
  $('tutGo').onclick = () => { hideCard(); lockPointer(); };
}

function showFail(): void {
  if (!sim?.failure) return;
  const f = sim.failure;
  const lines = f.lines.map((t, i) => `<p class="${i < f.lines.length - 1 || f.lines.length < 3 ? 'math' : ''}">${html(t)}</p>`).join('');
  showCard('fail', `<h2>אופס!</h2><p><b>${FAIL_TITLE[f.kind]}</b></p>${lines}<div class="row"><button class="btn primary retry" id="failGo" aria-label="נסו שוב">⟳</button></div><p class="stats">החפץ חזר לכן שלו. נסו שוב.</p>`);
  $('failGo').onclick = () => { sim?.dismiss(); hideCard(); lockPointer(); };
}

function showWin(): void {
  if (!sim || !level) return;
  const stars = sim.stars;
  const prev = save.stars[level.id] ?? 0;
  if (level.id > 0) save.stars[level.id] = Math.max(prev, stars);
  const next = LEVELS.find((l) => l.id === level!.id + 1);
  if (next) { save.current = next.id; selected = next.id; }
  persist();
  flushLearn(sim);
  const s = sim.stats;
  const why: string[] = [];
  if (s.hints) why.push('השתמשתם ברמז');
  if (s.alarms) why.push('הפעלתם אזעקה');
  if (s.failures && !s.alarms) why.push('הנחה שגויה');
  if (s.regrabs > 1) why.push('הרבה תפיסות חוזרות');
  const starSpans = [0, 1, 2].map((i) => `<span class="${i < stars ? '' : 'off'}" style="animation-delay:${0.15 + i * 0.2}s">★</span>`).join('');
  const isGen = level.id < 0;
  showCard('win', `<h2>${isGen ? 'שוד מוצלח!' : 'נמלטתם!'}</h2><div class="bigstars">${starSpans}</div><p>${html(level.title)}</p><p class="stats">${why.length ? why.join(' · ') : 'שוד מושלם: בלי רמז, בלי אזעקה'}</p>
  <div class="row">${next && !isGen ? '<button class="btn primary" id="winNext">לשלב הבא</button>' : ''}${isGen ? '<button class="btn primary" id="winMore">עוד חדר</button>' : ''}<button class="btn" id="winAgain">שוב</button><button class="btn" id="winMap">למפה</button></div>`);
  const nb = document.getElementById('winNext');
  if (nb) nb.onclick = () => { hideCard(); startLevel(next!.id); };
  const mb = document.getElementById('winMore');
  if (mb) mb.onclick = () => { hideCard(); startGenerated(level!.world); };
  $('winAgain').onclick = () => { hideCard(); level && level.id > 0 ? startLevel(level.id) : startGenerated(level!.world); };
  $('winMap').onclick = () => { hideCard(); openMenu(); };
}

function showPause(): void {
  paused = true;
  if (document.pointerLockElement) document.exitPointerLock();
  overlay.hidden = false;
  overlay.innerHTML = `<div class="card"><h2>הפסקה</h2>
  <p class="stats">${html(level?.objective ?? '')}</p>
  <label class="toggle"><input type="checkbox" id="optReduced" ${reduced ? 'checked' : ''}> הפחתת תנועה</label>
  <label class="toggle"><input type="checkbox" id="optMute" ${audio.muted ? 'checked' : ''}> השתקה</label>
  <p class="stats">תנועה: <span class="ltr">WASD</span> / חיצים · עכבר להסתכל · לחיצה לתפוס/להניח · <span class="ltr">R</span> לסובב · <span class="ltr">Shift</span> לאט · רווח לטפס · <span class="ltr">H</span> רמז</p>
  <div class="row"><button class="btn primary" id="pResume">המשך</button><button class="btn" id="pRestart">התחלה מחדש</button><button class="btn" id="pMap">למפה</button></div></div>`;
  $('pResume').onclick = resume;
  $('pRestart').onclick = () => { resume(); if (level) (level.id > 0 ? startLevel(level.id) : startGenerated(level.world)); };
  $('pMap').onclick = () => { resume(); openMenu(); };
  $<HTMLInputElement>('optReduced').onchange = (e) => { reduced = (e.target as HTMLInputElement).checked; save.reduced = reduced; document.body.classList.toggle('reduced', reduced); persist(); };
  $<HTMLInputElement>('optMute').onchange = (e) => setMuted((e.target as HTMLInputElement).checked);
  $('pResume').focus();
}
function resume(): void {
  overlay.hidden = true;
  paused = false;
  controls.clear();
}
function setMuted(m: boolean): void {
  audio.setMuted(m);
  save.muted = m;
  persist();
  $('btnMute').textContent = m ? '🔇' : '🔊';
  $('menuMute').textContent = m ? '🔇' : '🔊';
}

function lockPointer(): void {
  try {
    const r = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
    r?.catch?.(() => undefined);
  } catch { /* unavailable: drag-to-look fallback */ }
}

// ─────────────── level lifecycle ───────────────
function clearLevel(): void {
  if (view) {
    scene.remove(view.root);
    view.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry?.dispose();
    });
  }
  holder.clear();
  outline.selectedObjects = [];
  for (const b of bursts) worldFx.remove(b.pts);
  bursts.length = 0;
  for (const c of chunks) worldFx.remove(c.m);
  chunks.length = 0;
  view = null;
  flushLearn(sim);
  sim = null;
  audio.alarm(false);
  $('vignette').classList.remove('on');
  $('slit').classList.remove('on');
}

function startLevel(id: number): void {
  enterLevel(levelById(id));
}

function startGenerated(world: number): void {
  enterLevel(generateLevel(world, Math.floor(Math.random() * 1e9)));
}

function enterLevel(l: Level): void {
  clearLevel();
  level = l;
  selected = l.id > 0 ? l.id : selected;
  sim = new Sim(l);
  view = buildLevel(l);
  scene.add(view.root);
  scene.fog = l.room.theme === 'rooftop' ? new THREE.Fog(themeFog(l), 40, 120) : new THREE.FogExp2(themeFog(l), 0.035);
  scene.background = l.room.theme === 'rooftop' ? view.sky : themeFog(l);
  exOrient.clear();
  solvedLaserOff.clear();
  successGlow = null;
  raccoonShow = null;
  consequenceFx = null;
  camY = sim.player.y + EYE;
  acc = 0;
  mode = 'play';
  menuEl.hidden = true;
  hud.hidden = false;
  $('toast').className = '';
  toastTimer = 0;
  mainPass.scene = scene;
  mainPass.camera = camera;
  overlayPass.enabled = true;
  outline.enabled = true;
  const wname = WORLDS.find((w) => w.id === l.world)?.title ?? '';
  $('lvlName').innerHTML = html(l.id > 0 ? `⟦${l.id}⟧ · ${l.title}` : `${wname} · ${l.title}`);
  $('lvlObj').innerHTML = html(l.objective);
  $('hintBox').hidden = true;
  $<HTMLButtonElement>('btnHint').disabled = !!l.noHints || l.hint.length === 0;
  // Raccoon waits near the exit.
  const r = view.raccoon.root;
  r.visible = true;
  r.position.set(l.exit.pos[0] + 0.6, l.exit.pos[1], l.exit.pos[2] + 0.4);
  view.raccoon.play(['idle', 'wave', 'breath']);
  if (l.tutorial?.length) showTutorial(l);
  else {
    showToast(l.objective, '', 3200);
    hideCard();
  }
}

function openMenu(): void {
  clearLevel();
  level = null;
  mode = 'menu';
  hud.hidden = true;
  menuEl.hidden = false;
  overlayPass.enabled = false;
  outline.enabled = false;
  if (!menu) {
    menu = buildMenu();
    menu.camera.aspect = camera.aspect;
    menu.camera.updateProjectionMatrix();
  }
  mainPass.scene = menu.scene;
  mainPass.camera = menu.camera;
  if (document.pointerLockElement) document.exitPointerLock();
  renderMenuDom();
}

function renderMenuDom(): void {
  $('menuStars').innerHTML = `<bdi dir="ltr">${totalStars()} / ${LEVELS.length * 3}</bdi>`;
  const nodes = $('nodes');
  nodes.innerHTML = '';
  const firstOpen = LEVELS.find((l) => unlocked(l.id) && !save.stars[l.id])?.id ?? LEVELS[LEVELS.length - 1].id;
  for (const l of LEVELS) {
    const b = document.createElement('button');
    b.className = 'node' + (unlocked(l.id) ? '' : ' locked') + (l.id === firstOpen ? ' current' : '') + (l.id === selected ? ' sel' : '');
    b.dataset.id = String(l.id);
    b.innerHTML = `${l.id}<span class="nstars">${starsHtml(save.stars[l.id] ?? 0)}</span>`;
    b.setAttribute('aria-label', `שלב ${l.id}: ${l.title}${unlocked(l.id) ? '' : ' (נעול)'}`);
    b.onclick = () => {
      audio.unlock();
      if (!unlocked(l.id)) { showToast('נעול — סיימו את השלב הקודם', 'bad'); return; }
      selected = l.id;
      renderMenuDom();
    };
    b.ondblclick = () => unlocked(l.id) && startLevel(l.id);
    nodes.appendChild(b);
  }
  const halls = $('halls');
  halls.innerHTML = WORLDS.map((w) => `<div class="hall" data-w="${w.id}">${html(w.title)}</div>`).join('');
  if (!unlocked(selected)) selected = firstOpen;
  const l = levelById(selected);
  const w = WORLDS.find((x) => x.id === l.world)!;
  const transfer = [5, 10, 15, 18].includes(l.id);
  const genOk = LEVELS.filter((x) => x.world === l.world).every((x) => (save.stars[x.id] ?? 0) > 0) && l.world < 5;
  $('levelCard').innerHTML = `<h3>${html(`שלב ⟦${l.id}⟧ · ${l.title}`)}${l.extension ? '<span class="tag">הרחבה</span>' : ''}${transfer ? '<span class="tag">העברה</span>' : ''}</h3><p>${html(w.title)} — ${html(w.subtitle)}</p><p>${html(l.objective)}</p><div class="cstars">${starsHtml(save.stars[l.id] ?? 0)}</div>${genOk ? `<button class="btn" id="btnGen">חדר חדש ב${html(w.title)}</button>` : ''}`;
  const gb = document.getElementById('btnGen');
  if (gb) gb.onclick = () => { audio.unlock(); startGenerated(l.world); };
  $('btnContinue').innerHTML = html(`${save.stars[l.id] ? 'שחקו שוב' : 'המשך'} · שלב ⟦${l.id}⟧ ‹`);
  $('btnContinue').onclick = () => { audio.unlock(); startLevel(selected); };
  $('menuNote').innerHTML = 'שוד במוזיאון הפרופורציות · יחס דמיון לכיתה ח׳ (Workbook, פרק 6)';
}

function positionMenuDom(): void {
  if (!menu) return;
  const w = app.clientWidth, h = app.clientHeight;
  const v = new THREE.Vector3();
  for (const el of Array.from($('nodes').children) as HTMLElement[]) {
    const p = menu.nodePos.get(Number(el.dataset.id));
    if (!p) continue;
    v.copy(p).project(menu.camera);
    el.style.left = `${((v.x + 1) / 2) * w}px`;
    el.style.top = `${((1 - v.y) / 2) * h}px`;
  }
  for (const el of Array.from($('halls').children) as HTMLElement[]) {
    const p = menu.hallPos.get(Number(el.dataset.w));
    if (!p) continue;
    v.copy(p).project(menu.camera);
    el.style.left = `${((v.x + 1) / 2) * w}px`;
    el.style.top = `${((1 - v.y) / 2) * h}px`;
  }
}

// ─────────────── input wiring ───────────────
$('btnHint').onclick = () => useHint();
$('btnPause').onclick = () => (paused ? resume() : showPause());
$('btnMute').onclick = () => setMuted(!audio.muted);
$('menuMute').onclick = () => setMuted(!audio.muted);
$('menuMotion').onclick = () => { reduced = !reduced; save.reduced = reduced; document.body.classList.toggle('reduced', reduced); persist(); showToast(reduced ? 'הפחתת תנועה: פעיל' : 'הפחתת תנועה: כבוי'); };
$('tAct').addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); audio.unlock(); if (sim?.phase === 'explain') { sim.dismiss(); hideCard(); } else controls.pressAct(); });
$('tRot').addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); controls.pressRotate(); });
$('tClimb').addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); controls.pressClimb(); });
canvas.addEventListener('mousedown', () => audio.unlock());
canvas.addEventListener('touchstart', () => audio.unlock());
controls.onKey = (code) => {
  audio.unlock();
  if (mode !== 'play') {
    if (mode === 'menu' && code === 'Enter') startLevel(selected);
    return;
  }
  if (code === 'KeyP' || code === 'Escape') {
    if (cardKind) return;
    paused ? resume() : showPause();
  }
  if (code === 'KeyH') useHint();
  if (code === 'KeyM') setMuted(!audio.muted);
  if (code === 'KeyF') {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void app.requestFullscreen?.();
  }
};
let hadLock = false;
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) { hadLock = true; return; }
  // Only an Esc that released a real lock pauses (a failed lock request, e.g. in an iframe, does not).
  if (hadLock && mode === 'play' && !cardKind && !paused && sim && sim.phase !== 'won' && !manual) showPause();
  hadLock = false;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play' && !paused && !cardKind && !manual) showPause();
});

function useHint(): void {
  if (!sim || !level) return;
  if (level.noHints) { showToast('בשלב הזה אין רמזים — רק אתם והעדשה', 'bad'); return; }
  if (!sim.useHint()) return;
  const box = $('hintBox');
  box.hidden = false;
  box.innerHTML = level.hint.map((h) => html(h)).join('<br>');
}

// ─────────────── per-frame sync ───────────────
function handleEvents(): void {
  if (!sim || !view || !level) return;
  for (const e of sim.events.splice(0)) onEvent(e);
}

function onEvent(e: GameEvent): void {
  if (!sim || !view || !level) return;
  switch (e.type) {
    case 'step': audio.step(); viewBob += 1; break;
    case 'grab': audio.grab(); showToast(e.pad ? `תפסתם ממרחק ⟦${e.d1.toFixed(2)}⟧ מ'` : `תפסתם · ⟦d₁ = ${e.d1.toFixed(2)}⟧ מ'`); break;
    case 'drop': audio.whoosh(); break;
    case 'floor': audio.whoosh(); showToast('העדשה עובדת רק על מטרה — המוצג חזר לכן', '', 2200); break;
    case 'fit': {
      audio.fit();
      successGlow = { exId: e.exId, t: 0 };
      const t = level.targets.find((x) => x.id === e.targetId)!;
      const p = new THREE.Vector3(...t.anchor);
      burst(p.clone().add(new THREE.Vector3(0, 0.5, 0)), '#ffd36a', 70, 4, 0.12, 3, 1.6);
      showToast('מושלם! נכנס בדיוק', 'good', 2000);
      shake = Math.max(shake, 0.04);
      if (t.success === 'raccoon' || t.success === 'open') {
        raccoonShow = { pos: p.clone().add(new THREE.Vector3(Math.sin(t.yaw) * 1.1 + Math.cos(t.yaw) * 0.9, 0, Math.cos(t.yaw) * 1.1 - Math.sin(t.yaw) * 0.9)), t: 0 };
        audio.cheer();
      }
      if (t.socket === 'loop' || t.socket === 'plate') solvedLaserOff.add(t.id);
      break;
    }
    case 'exitOpen': setTimeout(() => showToast('היציאה נפתחה! רוצו אליה', 'good', 2600), 1200); break;
    case 'fail': {
      consequenceFx = e.kind;
      const f = sim.failure!;
      const p = new THREE.Vector3(...f.point);
      if (e.kind === 'crash' || e.kind === 'roofCrash') {
        audio.crash();
        shake = 0.35;
        burst(p.clone().add(new THREE.Vector3(0, 1, 0)), '#cfe8ff', 120, 6, 0.1, 9, 2);
        if (e.kind === 'roofCrash') {
          burst(new THREE.Vector3(p.x, level.room.h - 0.2, p.z), '#e8e0d0', 90, 3, 0.16, 9, 2.2);
          // A jagged hole in the ceiling with the night sky behind it.
          const ex = sim.ex(f.exId)!;
          const lb = localBounds(ex.def.shape, f.newScale, ex.orientation);
          const r0 = Math.max(lb.max[0] - lb.min[0], 1.2) * 0.65;
          const hole = new THREE.Shape();
          for (let i = 0; i <= 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            const rr = r0 * (0.75 + ((i * 37) % 11) / 22);
            if (i === 0) hole.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else hole.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          const holeM = new THREE.Mesh(new THREE.ShapeGeometry(hole), new THREE.MeshBasicMaterial({ color: '#8fb0ff', side: THREE.DoubleSide }));
          holeM.rotation.x = Math.PI / 2;
          holeM.position.set(p.x, level.room.h - 0.02, p.z + (lb.max[2] + lb.min[2]) / 2);
          view.root.add(holeM);
          const moonShaft = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 0.8, r0 * 1.2, level.room.h, 18, 1, true), new THREE.MeshBasicMaterial({ color: '#9fc4ff', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          moonShaft.position.set(holeM.position.x, level.room.h / 2, holeM.position.z);
          view.root.add(moonShaft);
          debris(new THREE.Vector3(p.x, level.room.h - 0.3, p.z + 0.5), 14);
        } else debris(p.clone().add(new THREE.Vector3(0, 0.8, 0.4)), 8);
        flash(0.35);
      } else if (e.kind === 'blownAway') audio.fan();
      else if (e.kind === 'jam' || e.kind === 'noFit') audio.jam();
      else audio.plop();
      showToast(FAIL_TITLE[e.kind], 'bad', 2200);
      break;
    }
    case 'alarm': audio.hey(); showToast('אזעקה! רוצו למחבוא!', 'bad', 2500); break;
    case 'spotted': audio.hey(); showToast('השומר ראה אתכם! למחבוא!', 'bad', 2500); break;
    case 'hide': audio.hide(); break;
    case 'caught': audio.caught(); shake = 0.3; flash(0.6); showToast('נתפסתם! חוזרים להתחלה', 'bad', 2200); break;
    case 'guardGone': audio.alarm(false); break;
    case 'climb': audio.climb(); break;
    case 'fell': flash(0.5); showToast('נפלתם לתהום! חוזרים להתחלה', 'bad'); break;
    case 'rotate': audio.rotate(); break;
    case 'cantDrop': audio.buzz(); showToast(e.reason, 'bad', 1400); break;
    case 'hint': audio.hint(); break;
    case 'won': audio.win(); setTimeout(showWin, 900); break;
  }
}

let flashT = 0;
function flash(a: number): void {
  if (reduced) a *= 0.3;
  flashT = a;
}

const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

function syncView(dt: number, realtime: boolean): void {
  if (!sim || !view || !level) return;
  const P = sim.player;
  const phase = sim.phase;
  if (phase !== lastPhase) {
    if (phase === 'explain' && !cardKind) showFail();
    if (lastPhase === 'explain' && cardKind === 'fail') hideCard();
    lastPhase = phase;
  }
  // Camera.
  const eyeY = P.y + EYE;
  camY += (eyeY - camY) * Math.min(1, dt * 12);
  if (Math.abs(eyeY - camY) > 3) camY = eyeY;
  camera.position.set(P.x, camY + (reduced ? 0 : Math.sin(viewBob * Math.PI) * 0.015), P.z);
  camera.rotation.set(P.pitch, P.yaw, 0);
  const alarmOn = phase === 'chase' || phase === 'hidden' || phase === 'caught' || (phase === 'consequence' && !!sim.failure?.alarm);
  if (phase === 'hidden' && sim.hideIdx >= 0) {
    // Peek out through the slit at the front of the upright sarcophagus.
    const h = level.hides[sim.hideIdx];
    const hv = view.hides[sim.hideIdx];
    const fy = hv ? hv.rotation.y : 0;
    camera.position.set(h[0] + Math.sin(fy) * 0.42, 1.5, h[1] + Math.cos(fy) * 0.42);
    const g = sim.guard.pos;
    camera.rotation.set(-0.08, Math.atan2(-(g[0] - camera.position.x), -(g[1] - camera.position.z)), 0);
  }
  if (phase === 'caught') {
    const g = sim.guard.pos;
    camera.rotation.set(Math.min(0.5, sim.phaseT * 0.4), Math.atan2(-(g[0] - P.x), -(g[1] - P.z)), Math.sin(sim.phaseT * 6) * 0.1);
  }
  // Roof crash: the camera follows the exhibit up through the ceiling for a moment.
  if (phase === 'consequence' && consequenceFx === 'roofCrash' && !reduced && sim.failure) {
    const fp = sim.failure.point;
    const up = Math.atan2(level.room.h - camY, Math.max(0.5, Math.hypot(fp[0] - P.x, fp[2] - P.z)));
    const e = Math.min(1, sim.phaseT * 2) * Math.min(1, (1.6 - sim.phaseT) * 3);
    camera.rotation.x = P.pitch + (Math.min(up, 0.9) - P.pitch) * Math.max(0, e);
  }
  if (shake > 0 && !reduced) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.3;
    camera.position.y += (Math.random() - 0.5) * shake * 0.3;
    camera.rotation.z += (Math.random() - 0.5) * shake * 0.1;
  }
  shake = Math.max(0, shake - dt * 0.8);
  camera.updateMatrixWorld();

  // Exhibits.
  outline.selectedObjects = [];
  for (const ex of sim.exhibits) {
    let m = view.exhibitMeshes.get(ex.def.id)!;
    if (exOrient.get(ex.def.id) !== ex.orientation) {
      if (exOrient.has(ex.def.id)) {
        const nm = buildExhibitMesh(ex.def, ex.orientation);
        m.parent?.remove(m);
        view.root.add(nm);
        view.exhibitMeshes.set(ex.def.id, nm);
        m = nm;
      }
      exOrient.set(ex.def.id, ex.orientation);
    }
    const lb = localBounds(ex.def.shape, 1, ex.orientation);
    const c = new THREE.Vector3((lb.min[0] + lb.max[0]) / 2, (lb.min[1] + lb.max[1]) / 2, (lb.min[2] + lb.max[2]) / 2);
    const holdDist = 1.55;
    // Held off-centre (lower right) so the aim point stays visible; same distance keeps the apparent size.
    const forward = new THREE.Vector3(0.2, -0.13, -1).applyQuaternion(camera.quaternion).normalize();
    const holdPos = camera.position.clone().add(forward.multiplyScalar(holdDist));
    const carryScale = sim.carry && sim.carry.exId === ex.def.id ? (ex.scale * holdDist) / sim.carry.grab3d : 0;
    if (ex.state === 'carried') {
      if (m.parent !== holder) holder.add(m);
      const s = carryScale;
      const bob = reduced ? 0 : Math.sin(sim.time * 2.2) * 0.012;
      m.scale.setScalar(s);
      m.rotation.set(0, ex.yaw, 0);
      tmpV.copy(c).multiplyScalar(s).applyEuler(m.rotation);
      m.position.copy(holdPos).sub(tmpV).add(new THREE.Vector3(0, bob, 0));
      outline.selectedObjects = [m];
      sparkles.visible = true;
      updateSparkles(holdPos, Math.max(0.2, (lb.max[1] - lb.min[1]) * s * 0.7));
      continue;
    }
    if (ex.state === 'flying' && sim.whoosh && sim.whoosh.exId === ex.def.id) {
      if (m.parent !== holder) holder.add(m);
      const w = sim.whoosh;
      const k = Math.min(1, w.t / w.dur);
      const e = 1 - Math.pow(1 - k, 3);
      const startS = (w.from.scale * holdDist) / Math.max(0.3, lastGrab3d);
      const s = startS * Math.pow(w.newScale / startS, e);
      const yaw = ex.yaw + (w.yaw - ex.yaw) * e;
      m.scale.setScalar(s);
      m.rotation.set(0, yaw, 0);
      const target = new THREE.Vector3(...w.to);
      const startPos = holdPos.clone().sub(tmpV.copy(c).multiplyScalar(startS).applyEuler(m.rotation));
      m.position.copy(startPos).lerp(target, e);
      sparkles.visible = true;
      updateSparkles(m.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 0.4);
      continue;
    }
    if (m.parent !== view.root) view.root.add(m);
    m.position.set(ex.pos[0], ex.pos[1], ex.pos[2]);
    m.rotation.set(0, ex.yaw, 0);
    m.scale.setScalar(ex.scale);
    // Consequence animation on the failed exhibit.
    if (phase === 'consequence' && sim.failure?.exId === ex.def.id) animateFailure(m, sim.phaseT, sim.failure.kind, level.targets.find((t) => t.id === sim!.failure!.targetId)?.yaw ?? P.yaw);
  }
  if (!sim.carry && !(sim.whoosh)) sparkles.visible = false;
  if (sim.carry) lastGrab3d = sim.carry.grab3d;

  // Success glow on the placed exhibit.
  if (successGlow) {
    successGlow.t += dt;
    const t = level.targets.find((x) => x.accepts === successGlow!.exId);
    const tv = t && view.targets.get(t.id);
    if (tv?.glow) (tv.glow.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.7 * (1 - successGlow.t / 1.4));
    if (successGlow.t > 1.4) successGlow = null;
  }
  // Target highlights (no size preview: only "this is the target you're aiming at").
  for (const [id, tv] of view.targets) {
    if (!tv.glow) continue;
    const aimed = sim.carry && sim.aim.kind === 'target' && sim.aim.id === id;
    if (successGlow && level.targets.find((x) => x.accepts === successGlow!.exId)?.id === id) continue;
    const mat = tv.glow.material as THREE.MeshBasicMaterial;
    const gapFail = phase === 'consequence' && sim.failure?.targetId === id && (sim.failure.kind === 'gapLeft' || sim.failure.kind === 'tooShort');
    mat.color.set(gapFail ? '#ff3a3a' : '#ffd36a');
    mat.opacity = gapFail ? 0.35 + Math.sin(sim.time * 12) * 0.2 : aimed ? 0.18 + Math.sin(sim.time * 6) * 0.08 : 0;
    tv.plate.visible = sim.targetActive(tv.target) || sim.solved.has(id);
  }
  // Hint: the placard and the plate that make the ratio glow (never the answer).
  if (sim.hintShown) {
    const glowAmt = 0.45 + Math.sin(sim.time * 5) * 0.3;
    for (const t of level.targets) {
      if (!sim.targetActive(t)) continue;
      const pm = view.placards.get(t.accepts);
      if (pm) (pm.material as THREE.MeshStandardMaterial).emissiveIntensity = glowAmt;
      const plane = view.targets.get(t.id)?.plate.children[0] as THREE.Mesh | undefined;
      if (plane?.material) (plane.material as THREE.MeshStandardMaterial).emissiveIntensity = glowAmt;
    }
  }
  // Lasers turn off for solved loop/plate targets.
  for (const id of solvedLaserOff) {
    const t = level.targets.find((x) => x.id === id)!;
    for (const lz of view.lasers) {
      const b = new THREE.Box3().setFromObject(lz);
      if (b.containsPoint(new THREE.Vector3(t.anchor[0], b.min.y + 0.01, t.anchor[2]))) lz.visible = false;
    }
  }
  if (level.targets.some((t) => t.socket === 'window' && sim!.solved.has(t.id))) for (const mb of view.moonbeams) mb.visible = false;
  // Lasers flicker.
  for (const lz of view.lasers) lz.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh && mm.material === (mm.material as THREE.MeshBasicMaterial) && (mm.material as THREE.MeshBasicMaterial).blending === THREE.AdditiveBlending) (mm.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(sim!.time * 30) * 0.15; });
  for (const f of view.ventFans) f.rotation.z += dt * (phase === 'consequence' && consequenceFx === 'blownAway' ? 30 : 6);

  // Exit portal.
  const open = sim.allSolved();
  const portal = view.exit.userData.portal as THREE.Mesh;
  const near = Math.min(1, Math.max(0, (Math.hypot(P.x - level.exit.pos[0], P.z - level.exit.pos[2]) - 0.6) / 2.5));
  (portal.material as THREE.MeshBasicMaterial).opacity = (open ? 0.45 + Math.sin(sim.time * 3) * 0.12 : 0.04) * near;
  view.exitLight.intensity = open ? 8 : 0;
  view.exit.visible = true;

  // Alarm.
  for (const l of view.alarmLights) l.intensity = alarmOn ? (Math.sin(sim.time * 10) > 0 ? 40 : 4) : 0;
  $('vignette').classList.toggle('on', alarmOn);
  $('lensHud').classList.toggle('alarm', alarmOn);
  $('slit').classList.toggle('on', phase === 'hidden');
  if (realtime) {
    audio.alarm(alarmOn && phase !== 'hidden' ? true : alarmOn);
    audio.setMusicTension(alarmOn);
  }
  if (!alarmOn) audio.alarm(false);

  // Guard.
  const G = sim.guard;
  const gr = view.guard;
  const showGuard = G.mode !== 'off' || (phase === 'consequence' && consequenceFx === 'pocketed');
  gr.root.visible = showGuard;
  if (showGuard) {
    if (G.mode === 'off' && sim.failure) {
      // Pocketing: the guard pops in next to the tiny exhibit.
      const fp = sim.failure.point;
      gr.root.position.set(fp[0] + 0.8, 0, fp[2] + 0.6);
      gr.root.rotation.y = Math.atan2(-0.8, -0.6) + Math.PI;
      gr.play(['pick', 'look', 'idle']);
    } else {
      gr.root.position.set(G.pos[0], 0, G.pos[1]);
      gr.root.rotation.y = G.yaw + Math.PI;
      const moving = G.mode === 'chase' || G.mode === 'leave' || (G.mode === 'search' && G.t < 1.2) || (G.mode === 'patrol' && sim.moved);
      if (G.mode === 'chase') gr.play(['run']);
      else if (G.mode === 'grab') gr.play(['faceplant', 'fall', 'dive', 'hit'], { once: true });
      else if (G.mode === 'search' && G.t > 1.2) gr.play(G.t > 2.8 ? ['scratch', 'confus', 'think', 'look', 'idle'] : ['look', 'idle']);
      else if (moving) gr.play(['walk']);
      else gr.play(['idle', 'look', 'breath']);
      gr.update(G.mode === 'patrol' && !sim.moved ? 0 : dt, moving);
    }
    if (G.mode === 'off') gr.update(dt, false);
  }

  // Raccoon.
  const rc = view.raccoon;
  if (raccoonShow) {
    raccoonShow.t += dt;
    rc.root.position.lerp(raccoonShow.pos, Math.min(1, dt * 6));
    rc.root.rotation.y = Math.atan2(P.x - rc.root.position.x, P.z - rc.root.position.z);
    rc.play(['cheer', 'jump', 'dance', 'wave']);
    if (raccoonShow.t > 3.2) {
      raccoonShow = null;
      rc.play(['idle', 'wave', 'breath']);
    }
  } else {
    // The raccoon waits at the target it will take the loot from, then at the exit.
    const waitAt = level.targets.find((t) => t.success === 'raccoon' && sim!.targetActive(t));
    const home = waitAt
      ? new THREE.Vector3(waitAt.anchor[0] + Math.sin(waitAt.yaw) * 0.9 + Math.cos(waitAt.yaw) * 1.1, 0, waitAt.anchor[2] + Math.cos(waitAt.yaw) * 0.9 - Math.sin(waitAt.yaw) * 1.1)
      : new THREE.Vector3(level.exit.pos[0] + 0.6, level.exit.pos[1], level.exit.pos[2] + 0.4);
    rc.root.position.lerp(home, Math.min(1, dt * 2));
    rc.root.rotation.y = Math.atan2(P.x - rc.root.position.x, P.z - rc.root.position.z);
    if (phase === 'won') rc.play(['cheer', 'jump', 'dance']);
  }
  rc.update(dt, !!raccoonShow);

  // Aim dot + rangefinder beam.
  const a = sim.aim;
  const showAim = phase === 'play' && a.kind !== 'none';
  aimDot.visible = showAim || (phase === 'play' && !!sim.carry);
  aimLine.visible = !!sim.carry && phase === 'play';
  if (aimDot.visible) {
    aimDot.position.set(a.point[0], a.point[1] + 0.02, a.point[2]);
    (aimDot.material as THREE.SpriteMaterial).color.set(a.valid ? '#ff2a2a' : '#888888');
    aimDot.scale.setScalar(0.12 + Math.min(0.4, camera.position.distanceTo(aimDot.position) * 0.025));
  }
  if (aimLine.visible) {
    const tip = new THREE.Vector3(0.2, -0.17, -0.45).applyQuaternion(camera.quaternion).add(camera.position);
    const pos = aimLineGeo.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, tip.x, tip.y, tip.z);
    pos.setXYZ(1, a.point[0], a.point[1] + 0.02, a.point[2]);
    pos.needsUpdate = true;
  }

  // View model: lower right, bobbing; hidden while hiding/caught.
  viewModel.visible = phase !== 'hidden' && phase !== 'caught';
  const bob = reduced ? 0 : Math.sin(viewBob * Math.PI) * 0.008;
  const portrait = camera.aspect < 1;
  const vmLocal = portrait ? new THREE.Vector3(0.14, -0.3 + bob, -0.5) : new THREE.Vector3(0.23, -0.23 + bob, -0.42);
  viewModel.scale.setScalar(portrait ? 0.7 : 1);
  viewModel.position.copy(vmLocal.applyQuaternion(camera.quaternion).add(camera.position));
  tmpQ.setFromEuler(new THREE.Euler(0.12, -0.22, 0.05));
  viewModel.quaternion.copy(camera.quaternion).multiply(tmpQ);

  updateBursts(dt);
  if (flashT > 0) {
    flashT = Math.max(0, flashT - dt * 1.5);
    $('flash').style.opacity = String(flashT);
  }
}
let lastGrab3d = 1;

function animateFailure(m: THREE.Object3D, t: number, kind: ConsequenceKind, yaw: number): void {
  const k = Math.min(1, t / 1.6);
  switch (kind) {
    case 'crash':
      m.rotation.z = Math.sin(t * 28) * 0.12 * (1 - k);
      m.rotation.x = Math.sin(t * 21) * 0.08 * (1 - k);
      break;
    case 'roofCrash':
      m.position.y += t * 1.8;
      m.rotation.z = Math.sin(t * 18) * 0.1;
      break;
    case 'fallThrough':
      m.position.y -= t * t * 5;
      break;
    case 'blownAway':
      m.position.x += Math.sin(yaw) * t * t * 6;
      m.position.z += Math.cos(yaw) * t * t * 6;
      m.position.y += t * 1.5;
      m.rotation.set(t * 9, t * 7, t * 5);
      break;
    case 'pocketed':
      m.scale.multiplyScalar(Math.max(0.001, 1 - Math.max(0, t - 0.7) * 1.5));
      m.position.y += Math.max(0, t - 0.7) * 0.6;
      break;
    case 'tooShort':
      m.rotation.x = Math.min(Math.PI / 2, Math.max(0, t - 0.6) * 2.2);
      break;
    case 'gapLeft':
      m.rotation.z = Math.sin(t * 10) * 0.03;
      break;
    case 'jam':
      m.rotation.z = Math.sin(t * 40) * 0.08 * (1 - k);
      if (t > 0.9) { m.position.y -= (t - 0.9) ** 2 * 6; m.rotation.x = (t - 0.9) * 2; }
      break;
    case 'noFit':
      m.position.x += Math.sin(yaw) * t * 1.5;
      m.position.z += Math.cos(yaw) * t * 1.5;
      m.position.y += Math.sin(Math.min(Math.PI, t * 5)) * 0.2 - Math.max(0, t - 0.6) ** 2 * 4;
      m.rotation.x = t * 4;
      break;
  }
}

function updateSparkles(center: THREE.Vector3, r: number): void {
  const pos = sparkles.geometry.getAttribute('position') as THREE.BufferAttribute;
  const seeds = sparkles.userData.seeds as number[][];
  const t = sim?.time ?? 0;
  for (let i = 0; i < seeds.length; i++) {
    const [a, y, s] = seeds[i];
    const ang = a + t * (0.6 + s);
    pos.setXYZ(i, center.x + Math.cos(ang) * r * (0.9 + s * 0.4), center.y + y * r * 0.9 + Math.sin(t * 2 + a) * 0.03, center.z + Math.sin(ang) * r * (0.9 + s * 0.4));
  }
  pos.needsUpdate = true;
  (sparkles.material as THREE.PointsMaterial).size = Math.max(0.02, r * 0.09);
}

function updateHud(): void {
  if (!sim || !level) return;
  const live = starsFor(sim.stats);
  $('hudStars').innerHTML = starsHtml(sim.phase === 'won' ? sim.stars : live);
  const d1 = $('hudD1');
  if (sim.carry) {
    d1.textContent = `d₁ = ${sim.carry.d1.toFixed(2)} m`;
    d1.innerHTML = `<bdi dir="ltr">d₁ = ${sim.carry.d1.toFixed(2)}</bdi> מ'`;
    d1.classList.add('locked');
  } else {
    d1.innerHTML = `<bdi dir="ltr">d₁ = —</bdi>`;
    d1.classList.remove('locked');
  }
  const a = sim.aim;
  const dEl = $('hudD');
  if (a.kind !== 'none' && sim.phase === 'play') {
    dEl.innerHTML = `<bdi dir="ltr">d = ${a.d.toFixed(2)}</bdi> מ'`;
    dEl.classList.toggle('muted', !a.valid);
  } else {
    dEl.innerHTML = `<bdi dir="ltr">d = —</bdi>`;
    dEl.classList.add('muted');
  }
  let aimTag = '';
  let prompt = '';
  const touch = document.body.classList.contains('touch');
  const clickWord = touch ? 'הקישו על הכפתור' : 'לחצו';
  if (sim.phase === 'play') {
    if (!sim.carry && a.kind === 'exhibit') {
      const ex = sim.ex(a.id!)!;
      aimTag = ex.def.name;
      prompt = a.valid ? `${clickWord} לתפוס: ${ex.def.name}` : `${ex.def.name} — ${a.reason ?? ''}`;
      const pad = level.pads.find((p) => p.forId === ex.def.id);
      if (a.valid && pad && ex.state === 'pedestal' && Math.hypot(pad.pos[0] - sim.player.x, pad.pos[1] - sim.player.z) <= 0.5) prompt += ` · על משטח ⟦${pad.d}⟧ מ'`;
    } else if (sim.carry) {
      const ex = sim.ex(sim.carry.exId)!;
      if (a.kind === 'target') {
        const t = sim.target(a.id!)!;
        aimTag = t.name;
        prompt = a.valid ? `${clickWord} להניח על: ${t.name}` : a.reason ?? '';
      } else {
        aimTag = a.valid ? 'רצפה' : '';
        prompt = a.valid ? `${clickWord} להניח כאן` : a.reason ?? '';
      }
      if (ex.def.shape.type === 'tri') prompt += touch ? ' · ⟳ לסובב' : ' · R לסובב';
    } else if (!sim.allSolved()) {
      prompt = touch ? 'כוונו אל מוצג' : 'כוונו אל מוצג · Shift להליכה איטית';
    } else prompt = 'רוצו ליציאה!';
  } else if (sim.phase === 'chase') prompt = 'רוצו למחבוא המוזהב!';
  else if (sim.phase === 'hidden') prompt = 'שקט… השומר מחפש';
  $('hudAim').textContent = aimTag;
  $('prompt').innerHTML = html(prompt);
  $('crosshair').className = !sim.carry && a.kind === 'exhibit' && a.valid ? 'grab' : '';
  $('hideChip').hidden = sim.phase !== 'chase';
  $('tAct').textContent = sim.carry ? 'הניחו' : 'תפסו';
  $('tRot').hidden = !(sim.carry && sim.ex(sim.carry.exId)?.def.shape.type === 'tri');
  $('tClimb').hidden = !(touch && sim.phase === 'play' && sim.climbable());
  if (sim.phase === 'chase' && level.hides.length) {
    // Arrow toward the nearest hide spot, relative to where you're looking.
    const P = sim.player;
    let best = level.hides[0];
    for (const h of level.hides) if (Math.hypot(h[0] - P.x, h[1] - P.z) < Math.hypot(best[0] - P.x, best[1] - P.z)) best = h;
    const want = Math.atan2(-(best[0] - P.x), -(best[1] - P.z));
    const rel = Math.atan2(Math.sin(want - P.yaw), Math.cos(want - P.yaw));
    $('hideArrow').style.transform = `rotate(${-90 - (rel * 180) / Math.PI}deg)`;
  }
  if (toastTimer > 0) {
    toastTimer -= 1 / 60;
    if (toastTimer <= 0) $('toast').className = '';
  }
}

// ─────────────── loop ───────────────
let last = performance.now();
let fpsFrames = 0, fpsT = 0, fps = 0;

function stepSim(input: Input, steps: number): void {
  if (!sim) return;
  for (let i = 0; i < steps; i++) {
    sim.step(STEP, i === 0 ? input : { ...input, look: [0, 0], act: false, rotate: false, climb: false });
    handleEvents();
  }
}

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsFrames++;
  fpsT += dt;
  if (fpsT > 1) { fps = fpsFrames / fpsT; fpsFrames = 0; fpsT = 0; }
  if (mode === 'play' && sim) {
    const blocked = paused || cardKind === 'tutorial' || cardKind === 'win';
    if (!manual && !blocked) {
      const input = controls.read();
      if (cardKind === 'fail') input.act = false;
      acc += dt;
      const n = Math.floor(acc / STEP);
      acc -= n * STEP;
      if (n > 0) stepSim(input, Math.min(n, 4));
    } else if (blocked && !manual) controls.clear();
    syncView(dt, true);
    updateHud();
  } else if (mode === 'menu' && menu) {
    menu.update(dt, selected, reduced);
    positionMenuDom();
  }
  composer.render(dt);
  requestAnimationFrame(frame);
}

// ─────────────── test hooks ───────────────
declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
    learning_log: () => unknown[];
    __pt: unknown;
  }
}
window.render_game_to_text = () => {
  if (mode === 'menu') return JSON.stringify({ mode, selected, totalStars: totalStars(), stars: save.stars, unlocked: LEVELS.filter((l) => unlocked(l.id)).map((l) => l.id) });
  if (mode !== 'play' || !sim) return JSON.stringify({ mode });
  const base = JSON.parse(sim.toText());
  return JSON.stringify({ mode, paused, card: cardKind || null, fps: Math.round(fps), ...base });
};
window.advanceTime = (ms: number) => {
  manual = true;
  if (mode !== 'play' || !sim || paused || cardKind === 'tutorial' || cardKind === 'win') return;
  const steps = Math.max(1, Math.round(ms / (1000 * STEP)));
  stepSim(controls.read(), steps);
  syncView(steps * STEP, false);
  updateHud();
  composer.render(steps * STEP);
};
window.learning_log = () => [...learnBuffer, ...(sim?.log ?? [])];
window.__pt = { startLevel, openMenu, get sim() { return sim; }, hideCard, resume };

// ─────────────── boot ───────────────
async function boot(): Promise<void> {
  resize();
  await document.fonts.load('700 40px Rubik').catch(() => undefined);
  await document.fonts.load('500 40px Rubik').catch(() => undefined);
  await loadModels((d, t) => { $('lfill').style.width = `${(d / t) * 100}%`; });
  buildViewModel();
  setMuted(save.muted);
  $('loading').remove();
  const start = params.get('level');
  if (start && LEVELS.some((l) => l.id === Number(start))) startLevel(Number(start));
  else openMenu();
  requestAnimationFrame(frame);
}
void boot();
// Keep Character import used for type checking in builds that tree-shake.
void Character;
