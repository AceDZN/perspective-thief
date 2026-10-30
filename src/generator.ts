// Fresh rooms per world after the authored levels: a template level gets new numbers with a
// simple k, then the solver verifies it is solvable, unique within tolerance, and that the
// constant "drop at 2 × grab" strategy fails.
import { levelById, type Level, type Prop, type V2 } from './levels.ts';
import { checkDrop, fmt } from './rules.ts';
import { plan } from './solver.ts';

function rng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
const pick = <T>(r: () => number, xs: T[]): T => xs[Math.floor(r() * xs.length)];
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const n = (x: number) => fmt(x, 3);

type Mutator = (L: Level, r: () => number) => Level | null;

function setPad(L: Level, exId: string, d1: number, dir: V2 = [0, 1]): void {
  const ex = L.exhibits.find((e) => e.id === exId)!;
  const pad = L.pads.find((p) => p.forId === exId)!;
  pad.d = d1;
  pad.pos = [ex.pos[0] + dir[0] * d1, ex.pos[1] + dir[1] * d1];
}

const NICE_K = [1.5, 2.5, 3, 4, 5];

const MUTATORS: Record<number, Mutator[]> = {
  1: [
    // Cube into the niche; the mezzanine is twice the step height.
    (L, r) => {
      const [h, k] = pick(r, [[1.2, 1.5], [1.2, 3], [1.2, 4], [1.5, 2.5], [1.5, 3], [1.5, 5], [1.4, 3.5], [1.4, 4]] as [number, number][]);
      const s = h / k;
      const d1 = pick(r, [1.5, 2]);
      const ex = L.exhibits[0];
      ex.shape = { type: 'box', w: s, h: s, d: s, look: 'crate' };
      ex.measures.side.value = s;
      ex.placard = ['קובייה עתיקה', `צלע ⟦${n(s)}⟧ מ'`];
      const t = L.targets[0];
      t.need = { measure: 'side', value: h };
      t.plate = ['גומחה למדרגה', `גובה ⟦${n(h)}⟧ מ'`];
      t.anchor = [0, 0, -5 + h / 2 + 0.02];
      const mezz = L.props[0] as Extract<Prop, { kind: 'solid' }>;
      mezz.max[1] = 2 * h;
      L.exit.pos[1] = 2 * h;
      L.objective = `הניחו את הקובייה בגומחה שגובהה ⟦${n(h)}⟧ מ', וטפסו ליציאה`;
      L.hint = [`השוו את צלע הקובייה ⟦${n(s)}⟧ לגובה הגומחה ⟦${n(h)}⟧ — יחס אורכים.`];
      L.rulers[0].origin = [0, t.anchor[2]];
      setPad(L, 'cube', d1);
      return L;
    },
    // Bust on the empty plinth.
    (L, r) => {
      const [b, need] = pick(r, [[0.4, 1.0], [0.6, 0.9], [0.4, 1.2], [0.8, 1.2], [0.5, 1.25], [0.3, 0.9]] as [number, number][]);
      const d1 = pick(r, [1.6, 2, 2.4]);
      const ex = L.exhibits[0];
      if (ex.shape.type === 'model') ex.shape = { ...ex.shape, w: b * 0.7, h: b, d: b * 0.6 };
      ex.measures.height.value = b;
      ex.placard = ['פסל ראש משיש', `גובה ⟦${n(b)}⟧ מ'`];
      const t = L.targets[0];
      t.need = { measure: 'height', value: need };
      t.plate = ['כן ריק · חיישן משקל', `גובה הפסל ⟦${n(need)}⟧ מ'`];
      L.objective = `החליפו את הפסל החסר: החיישן מצפה לפסל בגובה ⟦${n(need)}⟧ מ'`;
      L.hint = [`השוו את גובה הפסל ⟦${n(b)}⟧ לגובה הנדרש ⟦${n(need)}⟧ — יחס אורכים.`];
      setPad(L, 'bust', d1);
      return L;
    },
  ],
  2: [
    // Laser triangle: new pedestal height / distance → a new wall height, found by AA.
    (L, r) => {
      const [hp, a] = pick(r, [[1, 2], [1.2, 2], [0.8, 1.5], [1, 2.5], [1.2, 2.4], [0.9, 1.8]] as [number, number][]);
      const H = (hp * 6) / a;
      const m = pick(r, [0.4, 0.5, 0.6, 0.8]);
      const k = H / m;
      if (H > 4.4 || k > 8 || Math.abs(k - Math.round(k * 2) / 2) > 1e-9) return null;
      const ex = L.exhibits[0];
      if (ex.shape.type === 'mirror') ex.shape = { ...ex.shape, h: m };
      ex.measures.height.value = m;
      ex.placard = ['מראה עתיקה', `גובה ⟦${n(m)}⟧ מ'`];
      L.targets[0].need = { measure: 'height', value: H };
      L.props = L.props.map((p) => {
        if (p.kind === 'solid' && p.mat === 'brass') return { ...p, min: [a, 0, -3.25], max: [a + 0.4, hp, -2.75] };
        if (p.kind === 'laserBeam') return { ...p, to: [6, H, -3] };
        if (p.kind === 'sign' && p.lines[0] === 'עמוד') return { ...p, pos: [a + 0.2, hp + 0.35, -2.7], lines: ['עמוד', `גובה ⟦${n(hp)}⟧ מ'`] };
        return p;
      });
      L.hint = [`המשולש הקטן: ⟦${n(a)}⟧ על הרצפה, ⟦${n(hp)}⟧ גובה. הגדול: ⟦6⟧ על הרצפה. צלעות מתאימות.`];
      setPad(L, 'mirror', pick(r, [0.6, 0.8, 1]));
      return L;
    },
    // Triangle sign into a similar frame, random orientations.
    (L, r) => {
      const fam = pick(r, [[3, 4, 5], [6, 8, 10], [5, 12, 13]] as [number, number, number][]);
      const unit = fam[2] === 13 ? 0.025 : fam[0] === 6 ? 0.04 : pick(r, [0.06, 0.08, 0.1]);
      const k = pick(r, [1.5, 2.5, 3]);
      const sides = fam.map((x) => Math.round(x * unit * 1000) / 1000) as [number, number, number];
      if (sides[2] * k > 1.6) return null;
      const cm = sides.map((x) => Math.round(x * 1000) / 10);
      const ex = L.exhibits[0];
      ex.shape = { type: 'tri', sides, t: 0.03, labels: cm.map(String) as [string, string, string] };
      ex.measures = { short: { value: cm[0], power: 1, unit: 'cm', label: 'צלע קצרה' } };
      ex.placard = ['שלט משולש', `צלעות ⟦${cm.join(', ')}⟧ ס"מ`];
      const target = Math.floor(r() * 3);
      ex.orientation = (target + 1 + Math.floor(r() * 2)) % 3;
      const t = L.targets[0];
      t.orientation = target;
      t.need = { measure: 'short', value: cm[0] * k };
      t.plate = ['מסגרת', `צלעות ⟦${cm.map((x) => n(x * k)).join(', ')}⟧ ס"מ`];
      L.hint = [`השוו צלע קצרה לצלע קצרה: ⟦${n(cm[0])}⟧ מול ⟦${n(cm[0] * k)}⟧. R מסובב.`];
      setPad(L, 'sign', pick(r, [1, 1.5, 2]));
      return L;
    },
  ],
  3: [
    // Rug on a pressure plate (area → k²).
    (L, r) => {
      const [w, d] = pick(r, [[1, 0.5], [0.8, 0.4], [0.6, 0.4], [1.2, 0.6], [0.5, 0.5]] as [number, number][]);
      const k = pick(r, [1.5, 2.5, 3]);
      if (w * k > 3 || d * k > 2.6) return null;
      const A = w * d, need = A * k * k;
      const ex = L.exhibits[0];
      ex.shape = { type: 'rug', w, d, look: 'rug' };
      ex.measures.area.value = A;
      ex.placard = ['שטיח', `⟦${n(w)} × ${n(d)}⟧ מ'`];
      const t = L.targets[0];
      t.need = { measure: 'area', value: need };
      t.plate = ['לוחית לחץ', `שטח ⟦${n(need)}⟧ מ"ר`, 'אותה צורה כמו השטיח'];
      t.zone = { c: [0, 0.3, -3], h: [Math.max(0.8, (w * k) / 2 + 0.2), 0.4, Math.max(0.6, (d * k) / 2 + 0.2)] };
      L.props = L.props.map((p) => (p.kind === 'laserLoop' ? { ...p, min: [-(w * k) / 2 - 0.45, -3 - (d * k) / 2 - 0.25], max: [(w * k) / 2 + 0.45, -3 + (d * k) / 2 + 0.25] } : p));
      L.objective = 'כסו את לוחית הלחץ בשטיח — בדיוק בשטח שלה';
      L.hint = [`שטח השטיח ⟦${n(A)}⟧ מול שטח הלוחית ⟦${n(need)}⟧ — יחס שטחים = ⟦k²⟧.`];
      setPad(L, 'rug', pick(r, [1.5, 2]));
      return L;
    },
    // Plinth fills a laser loop (perimeter → k).
    (L, r) => {
      const s = pick(r, [0.5, 0.6, 0.8, 1, 1.2]);
      const k = pick(r, NICE_K);
      if (s * k > 4 || s * k < 1.2) return null;
      const ex = L.exhibits[0];
      ex.shape = { type: 'box', w: s, h: Math.max(0.3, s * 0.5), d: s, look: 'plinth' };
      ex.measures.perimeter.value = 4 * s;
      ex.placard = ['בסיס ריבועי', `צלע ⟦${n(s)}⟧ מ'`];
      const t = L.targets[0];
      const P = 4 * s * k;
      t.need = { measure: 'perimeter', value: P };
      t.plate = ['לולאת לייזר', `היקף ⟦${n(P)}⟧ מ'`];
      t.zone = { c: [0, 0.5, -3], h: [(s * k) / 2 + 0.1, 0.6, (s * k) / 2 + 0.1] };
      L.props = L.props.map((p) => (p.kind === 'laserLoop' ? { ...p, min: [-(s * k) / 2, -3 - (s * k) / 2], max: [(s * k) / 2, -3 + (s * k) / 2] } : p));
      L.hint = [`היקף הבסיס: ⟦4 × ${n(s)}⟧. השוו להיקף הלולאה ⟦${n(P)}⟧ — יחס היקפים = ⟦k⟧.`];
      setPad(L, 'plinth', pick(r, [1.5, 2]));
      return L;
    },
  ],
  4: [
    // Gold cube on the elevator (weight → k³).
    (L, r) => {
      const c = pick(r, [10, 20, 25]);
      const w = pick(r, [1, 2, 3]);
      const k = pick(r, [1.5, 2.5, 3, 4]);
      if ((c / 100) * k > 1.2) return null;
      const need = w * k ** 3;
      const ex = L.exhibits[0];
      ex.shape = { type: 'box', w: c / 100, h: c / 100, d: c / 100, look: 'gold' };
      ex.measures.weight.value = w;
      ex.placard = ['קוביית זהב', `צלע ⟦${c}⟧ ס"מ · ⟦${w}⟧ ק"ג`];
      const t = L.targets[0];
      t.need = { measure: 'weight', value: need };
      t.plate = ['מעלית', `משקל נדרש ⟦${n(need)}⟧ ק"ג`];
      L.objective = `הפעילו את המעלית: היא זזה רק עם משקל של ⟦${n(need)}⟧ ק"ג`;
      L.hint = [`משקל ⟦${w}⟧ מול משקל ⟦${n(need)}⟧ — יחס נפחים = ⟦k³⟧.`];
      setPad(L, 'gold', pick(r, [1, 1.2, 1.5]));
      return L;
    },
    // Restore a congruent key from a different enlargement.
    (L, r) => {
      const s = pick(r, [1.5, 2.5, 3, 4]);
      const d1 = pick(r, [2, 3, 4, 4.5]);
      if (d1 / s < 0.7) return null;
      const ex = L.exhibits[0];
      ex.initialScale = s;
      ex.placard = ['המפתח הגנוב', `אורך עכשיו ⟦${n(12 * s)}⟧ ס"מ`, `(הגדלתם אותו פי ⟦${n(s)}⟧)`];
      L.hint = [`המפתח עכשיו פי ⟦${n(s)}⟧ מהמקורי. איזה ⟦k⟧ מחזיר אותו ליחס ⟦1⟧?`];
      setPad(L, 'key', d1);
      return L;
    },
  ],
};

const TEMPLATES: Record<number, number[]> = { 1: [1, 4], 2: [7, 8], 3: [13, 11], 4: [16, 17] };

/** Verify: solvable through the sim, and drop-at-2×-grab fails on every target. */
export function verifyGenerated(L: Level): boolean {
  const steps = plan(L);
  for (const s of steps) {
    if (!s.stand) return false;
    if (s.d2 < 0.8 || s.d2 > 11) return false;
    const ex = L.exhibits.find((e) => e.id === s.exId)!;
    const m = ex.measures[s.target.measure];
    const c = checkDrop({ measure: m, need: s.target.need, currentScale: ex.initialScale ?? 1, d1: s.d1, d2: 2 * s.d1 });
    if (c.verdict === 'fit') return false;
  }
  return true;
}

export function generateLevel(world: number, seed: number): Level {
  const w = Math.min(4, Math.max(1, world));
  const r = rng(seed);
  for (let attempt = 0; attempt < 80; attempt++) {
    const tid = pick(r, TEMPLATES[w]);
    const base = levelById(tid);
    const muts = MUTATORS[w].filter((_, i) => TEMPLATES[w][i] === tid);
    const L = (muts[0] ?? MUTATORS[w][0])(clone(base), r);
    if (!L) continue;
    L.id = -(tid * 1000 + (seed % 1000));
    L.title = `חדר מפתיע (${base.title})`;
    L.tutorial = undefined;
    L.noHints = false;
    if (verifyGenerated(L)) return L;
  }
  return clone(levelById(TEMPLATES[w][0]));
}
