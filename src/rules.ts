// Pure similarity rules for the lens. No Three.js here: the scene only renders what this decides.
//
// The lens rule: an exhibit grabbed at floor distance d1 and dropped at floor distance d2 is
// scaled by the similarity ratio k = d2 / d1 in every length. Perimeter scales by k, area by k²,
// volume and weight by k³ (World 4 extension).

export type Power = 1 | 2 | 3;
export type Unit = 'm' | 'cm' | 'm2' | 'cm2' | 'kg';

export interface Measure {
  /** Value at the exhibit's placard scale (scale = 1). */
  value: number;
  /** 1 = length / perimeter, 2 = area, 3 = volume / weight. */
  power: Power;
  unit: Unit;
  /** Hebrew label as written on placards and plates. */
  label: string;
}

export type ConsequenceKind =
  | 'crash' // smashes a display case / wall: alarm + guard chase
  | 'roofCrash' // taller than the ceiling: crashes through the roof, alarm + chase
  | 'fallThrough' // too small: falls through the grate / into the gap
  | 'tooShort' // too small: a ladder / pole / mirror / ramp / weight that doesn't reach
  | 'blownAway' // too small: the vent fan blows it away
  | 'pocketed' // too small: the guard pops in and pockets it
  | 'jam' // wrong orientation: wedges in the frame and drops out
  | 'noFit' // not similar to the frame: never fits
  | 'gapLeft'; // too narrow: leaves a gap the guard squeezes through

export interface Need {
  measure: string;
  /** Exact value the target asks for (measure units). */
  value: number;
  /** Optional physical slack, measure units. If absent, k must be within ±tol of the exact k. */
  min?: number;
  max?: number;
}

export const DEFAULT_TOL = 0.02;

export function ratio(d1: number, d2: number): number {
  if (!(d1 > 0) || !(d2 > 0)) throw new Error('distances must be positive');
  return d2 / d1;
}

export function scaledMeasure(m: Measure, scale: number): number {
  return m.value * Math.pow(scale, m.power);
}

/** The k window (relative to the exhibit's current scale) that satisfies a need. */
export function kWindow(m: Measure, need: Need, currentScale = 1, tol = DEFAULT_TOL): { k: number; kMin: number; kMax: number } {
  const base = scaledMeasure(m, currentScale);
  const root = (v: number) => Math.pow(v / base, 1 / m.power);
  const k = root(need.value);
  if (need.min !== undefined || need.max !== undefined) {
    return { k, kMin: root(need.min ?? need.value), kMax: root(need.max ?? need.value) };
  }
  return { k, kMin: k * (1 - tol), kMax: k * (1 + tol) };
}

export interface DropCheck {
  k: number;
  newScale: number;
  /** The relevant measure after the drop. */
  got: number;
  need: Need;
  verdict: 'fit' | 'tooBig' | 'tooSmall' | 'jam' | 'noFit';
  /** Exact k that was needed. */
  kNeeded: number;
}

export interface DropInput {
  measure: Measure;
  need: Need;
  currentScale: number;
  d1: number;
  d2: number;
  tol?: number;
  orientationOk?: boolean;
  similarShape?: boolean;
}

export function checkDrop(input: DropInput): DropCheck {
  const k = ratio(input.d1, input.d2);
  const newScale = input.currentScale * k;
  const got = scaledMeasure(input.measure, newScale);
  const w = kWindow(input.measure, input.need, input.currentScale, input.tol);
  let verdict: DropCheck['verdict'];
  // Allow a hair of float slack so exact-boundary drops count.
  const eps = 1e-9;
  if (input.similarShape === false) verdict = 'noFit';
  else if (k > w.kMax + eps) verdict = 'tooBig';
  else if (k < w.kMin - eps) verdict = 'tooSmall';
  else if (input.orientationOk === false) verdict = 'jam';
  else verdict = 'fit';
  return { k, newScale, got, need: input.need, verdict, kNeeded: w.k };
}

/** d2 needed for an exact fit, given the grab distance. */
export function dropDistanceFor(kNeeded: number, d1: number): number {
  return kNeeded * d1;
}

/** AA similar triangles: a known pair (h1, s1) and the other triangle's corresponding side s2 → h2. */
export function proportion(h1: number, s1: number, s2: number): number {
  return (h1 * s2) / s1;
}

/** Ratio a learner who confuses dimensions would use (k instead of the root). */
export function naiveK(m: Measure, need: Need, currentScale = 1): number {
  return need.value / scaledMeasure(m, currentScale);
}

export function powerName(p: Power): string {
  return p === 1 ? 'יחס אורכים' : p === 2 ? 'יחס שטחים' : 'יחס נפחים';
}

export function unitText(u: Unit): string {
  return { m: "מ'", cm: "ס\"מ", m2: 'מ"ר', cm2: 'סמ"ר', kg: 'ק"ג' }[u];
}

/** Round for display: up to 2 decimals, trailing zeros trimmed. */
export function fmt(n: number, digits = 2): string {
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return String(r);
}

export function fmtFixed(n: number, digits = 2): string {
  return n.toFixed(digits);
}

/**
 * The worked explanation shown after a failure, revealed step by step so the card never hands
 * over the answer on the first miss: attempt 1 shows the ratio used and which way to move,
 * attempt 2 adds which kind of ratio it is, attempt 3+ shows the needed k (and the root).
 * Numbers are marked with ⟦…⟧ for LTR rendering.
 */
export function explain(check: DropCheck, m: Measure, d1: number, d2: number, attempt = 3): string[] {
  const lines: string[] = [];
  lines.push(`השתמשתם ב־⟦k = ${fmt(d2)} ÷ ${fmt(d1)} = ${fmt(check.k)}⟧`);
  if (check.verdict === 'jam') {
    lines.push('היחס נכון, אבל הצלעות לא מתאימות: סובבו כך שכל צלע תפגוש את הצלע המתאימה לה.');
    return lines;
  }
  if (check.verdict === 'noFit') {
    lines.push('הצורה הזאת לא דומה למסגרת: הזוויות והצלעות שלה לא מתאימות לשל המסגרת, ולכן אין ⟦k⟧ שיתאים. שטח שווה לא אומר דמיון.');
    return lines;
  }
  const kind = m.power === 1 ? 'יחס אורכים — כל אורך גדל פי ⟦k⟧' : m.power === 2 ? 'יחס שטחים — השטח גדל פי ⟦k²⟧' : 'יחס נפחים — המשקל גדל פי ⟦k³⟧';
  if (attempt >= 2) lines.push(`זה ${kind}.`);
  if (attempt >= 3) {
    const n = check.need;
    if (n.min !== undefined && n.max !== undefined && m.power === 1) {
      const base = check.got / Math.pow(check.k, m.power) * 1; // measure at the current scale
      lines.push(`היה צריך ⟦k⟧ בין ⟦${fmt(n.min / base)}⟧ ל־⟦${fmt(n.max / base)}⟧`);
    } else {
      lines.push(`היה צריך ⟦k = ${fmt(check.kNeeded)}⟧ · ${powerName(m.power)}${m.power === 1 ? '' : ` = ⟦k${m.power === 2 ? '²' : '³'}⟧`}`);
      if (m.power === 2) lines.push(`השטח גדל פי ⟦k² = ${fmt(check.kNeeded ** 2)}⟧, לכן ⟦k = √${fmt(check.kNeeded ** 2)} = ${fmt(check.kNeeded)}⟧`);
      if (m.power === 3) lines.push(`המשקל גדל פי ⟦k³ = ${fmt(check.kNeeded ** 3)}⟧, לכן ⟦k = ∛${fmt(check.kNeeded ** 3)} = ${fmt(check.kNeeded)}⟧`);
    }
  }
  lines.push(check.k > check.kNeeded ? 'הניחו קרוב יותר.' : 'הניחו רחוק יותר.');
  return lines;
}

/**
 * The worked solution for a successful drop, for the results screen: the ratio the player had to
 * see, k, and the drop distance it gives. `scale` is the exhibit's scale before the drop.
 */
export function recap(m: Measure, scale: number, need: Need, d1: number): string {
  const have = m.value * Math.pow(scale, m.power);
  if (need.min !== undefined && need.max !== undefined && m.power === 1) {
    const lo = need.min / have, hi = need.max / have;
    return `${powerName(1)}: ⟦k⟧ בין ⟦${fmt(need.min)} ÷ ${fmt(have)} = ${fmt(lo)}⟧ ל־⟦${fmt(need.max)} ÷ ${fmt(have)} = ${fmt(hi)}⟧ · ⟦d₂⟧ בין ⟦${fmt(lo * d1)}⟧ ל־⟦${fmt(hi * d1)}⟧`;
  }
  const r = need.value / have;
  const k = Math.pow(r, 1 / m.power);
  const kPart = m.power === 1 ? `⟦k = ${fmt(k)}⟧` : `⟦k${m.power === 2 ? '²' : '³'} = ${fmt(r)}⟧ ← ⟦k = ${m.power === 2 ? '√' : '∛'}${fmt(r)} = ${fmt(k)}⟧`;
  return `${powerName(m.power)}: ⟦${fmt(need.value)} ÷ ${fmt(have)} = ${fmt(r)}⟧ ← ${kPart} · ⟦d₂ = ${fmt(k)} × ${fmt(d1)} = ${fmt(k * d1)}⟧`;
}

export interface StarInput {
  hints: number;
  alarms: number;
  failures: number;
  regrabs: number;
  caught?: number;
}

/**
 * 3 stars: no hint, no alarm, no failed drop. A hint costs one, any mistake one, and a second
 * failed drop or getting caught by the guard (instead of hiding) another. Never below 1.
 */
export function starsFor(s: StarInput): number {
  let stars = 3;
  if (s.hints > 0) stars -= 1;
  if (s.alarms > 0 || s.failures > 0) stars -= 1;
  if (s.regrabs > 1 || s.failures > 1 || (s.caught ?? 0) > 0) stars -= 1;
  return Math.max(1, stars);
}
