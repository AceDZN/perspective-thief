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
 * The short worked explanation shown after a failure. Returns plain strings; numbers are meant
 * to be wrapped in LTR spans by the HUD (they are marked with ⟦…⟧).
 */
export function explain(check: DropCheck, m: Measure, d1: number, d2: number): string[] {
  const lines: string[] = [];
  lines.push(`השתמשת ב־⟦k = ${fmt(d2)} ÷ ${fmt(d1)} = ${fmt(check.k)}⟧`);
  if (check.verdict === 'jam') {
    lines.push('היחס נכון, אבל הצלעות לא מתאימות: סובבו כך שכל צלע תפגוש את הצלע המתאימה לה.');
    return lines;
  }
  if (check.verdict === 'noFit') {
    lines.push('הצורה הזאת לא דומה למסגרת: היחס בין הצלעות שלה שונה, ואין k שיתאים.');
    return lines;
  }
  lines.push(`היה צריך ⟦k = ${fmt(check.kNeeded)}⟧ · ${powerName(m.power)}${m.power === 1 ? '' : ` = ⟦k${m.power === 2 ? '²' : '³'}⟧`}`);
  if (m.power === 2) lines.push(`השטח גדל פי ⟦k² = ${fmt(check.kNeeded ** 2)}⟧, לכן ⟦k = √${fmt(check.kNeeded ** 2)} = ${fmt(check.kNeeded)}⟧`);
  if (m.power === 3) lines.push(`המשקל גדל פי ⟦k³ = ${fmt(check.kNeeded ** 3)}⟧, לכן ⟦k = ∛${fmt(check.kNeeded ** 3)} = ${fmt(check.kNeeded)}⟧`);
  lines.push(`נקודת הנחה: ⟦d₂ = ${fmt(check.kNeeded)} × ${fmt(d1)} = ${fmt(check.kNeeded * d1)} מ'⟧`);
  return lines;
}

export interface StarInput {
  hints: number;
  alarms: number;
  failures: number;
  regrabs: number;
}

/** 3 stars: no hint, no alarm, no failed drop, ≤ 1 re-grab. A hint caps at 2. */
export function starsFor(s: StarInput): number {
  let stars = 3;
  if (s.hints > 0) stars -= 1;
  if (s.alarms > 0 || s.failures > 0) stars -= 1;
  if (s.regrabs > 1 || s.failures > 2) stars -= 1;
  return Math.max(1, stars);
}
