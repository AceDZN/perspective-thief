// Pure lens / similarity rules: ratio, k windows, drop verdicts, proportions, explanations, stars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkDrop,
  DEFAULT_TOL,
  dropDistanceFor,
  explain,
  fmt,
  kWindow,
  naiveK,
  powerName,
  proportion,
  ratio,
  recap,
  scaledMeasure,
  starsFor,
  type Measure,
  type Need,
} from '../src/rules.ts';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const len = (value: number): Measure => ({ value, power: 1, unit: 'm', label: 'אורך' });
const area = (value: number): Measure => ({ value, power: 2, unit: 'm2', label: 'שטח' });
const weight = (value: number): Measure => ({ value, power: 3, unit: 'kg', label: 'משקל' });
const need = (value: number, min?: number, max?: number): Need => ({ measure: 'x', value, min, max });

test('ratio is d2 ÷ d1 (never d2 − d1) and rejects non-positive distances', () => {
  assert.equal(ratio(2, 6), 3);
  assert.equal(ratio(8, 2), 0.25);
  assert.equal(ratio(4, 4), 1);
  assert.ok(near(ratio(2.4, 3.6), 1.5));
  assert.notEqual(ratio(2, 6), 6 - 2);
  assert.throws(() => ratio(0, 3));
  assert.throws(() => ratio(2, 0));
  assert.throws(() => ratio(-1, 3));
  assert.throws(() => ratio(NaN, 3));
});

test('scaledMeasure: length × k, area × k², weight × k³', () => {
  assert.ok(near(scaledMeasure(len(0.5), 3), 1.5));
  assert.ok(near(scaledMeasure(area(0.24), 3), 2.16));
  assert.ok(near(scaledMeasure(weight(2), 3), 54));
  assert.ok(near(scaledMeasure(area(0.5), 2), 2));
});

test('kWindow takes the 1st / 2nd / 3rd root and applies ±2 % by default', () => {
  assert.equal(DEFAULT_TOL, 0.02);
  for (const [m, n] of [[len(0.5), 1.5], [area(0.24), 2.16], [weight(2), 54]] as const) {
    const w = kWindow(m, need(n));
    assert.ok(near(w.k, 3), `power ${m.power}: k = ${w.k}`);
    assert.ok(near(w.kMin, 2.94) && near(w.kMax, 3.06), `power ${m.power}: window`);
  }
  // Area ratio 4 → k = 2; area ratio 16 → k = 4 (levels 13, 14).
  assert.ok(near(kWindow(area(0.5), need(2)).k, 2));
  assert.ok(near(kWindow(area(0.25), need(4)).k, 4));
  // Custom tolerance.
  const w = kWindow(len(1), need(2), 1, 0.05);
  assert.ok(near(w.kMin, 1.9) && near(w.kMax, 2.1));
});

test('kWindow is relative to the current scale (level 17: key enlarged × 2 → k = ½)', () => {
  const w = kWindow(len(12), need(12), 2);
  assert.ok(near(w.k, 0.5));
  assert.ok(near(w.kMin, 0.49) && near(w.kMax, 0.51));
});

test('kWindow with physical slack uses the min/max, not ±2 % (levels 2 and 3)', () => {
  const vent = kWindow(len(3), need(0.75, 0.7, 0.8));
  assert.ok(near(vent.k, 0.25));
  assert.ok(near(vent.kMin, 0.7 / 3) && near(vent.kMax, 0.8 / 3));
  const gap = kWindow(len(1.2), need(3.15, 3.0, 3.3));
  assert.ok(near(gap.kMin, 2.5) && near(gap.kMax, 2.75));
  // Slack on an area need is a square root too.
  const a = kWindow(area(1), need(4, 3.61, 4.41));
  assert.ok(near(a.kMin, 1.9) && near(a.kMax, 2.1));
});

test('checkDrop verdicts: fit, tooBig, tooSmall, and the exact window boundaries', () => {
  const base = { measure: len(0.5), need: need(1.5), currentScale: 1, d1: 2 };
  assert.equal(checkDrop({ ...base, d2: 6 }).verdict, 'fit');
  const c = checkDrop({ ...base, d2: 6 });
  assert.ok(near(c.k, 3) && near(c.newScale, 3) && near(c.got, 1.5) && near(c.kNeeded, 3));
  // Boundaries count (k = 2.94 and 3.06), a hair outside does not.
  assert.equal(checkDrop({ ...base, d2: 2 * 3.06 }).verdict, 'fit');
  assert.equal(checkDrop({ ...base, d2: 2 * 2.94 }).verdict, 'fit');
  assert.equal(checkDrop({ ...base, d2: 2 * 3.0601 }).verdict, 'tooBig');
  assert.equal(checkDrop({ ...base, d2: 2 * 2.9399 }).verdict, 'tooSmall');
  // The d₂ − d₁ misconception (want k = 3 → d₂ = 2 + 3 = 5) is too small.
  assert.equal(checkDrop({ ...base, d2: 5 }).verdict, 'tooSmall');
  // Slack windows include both physical limits.
  const gap = { measure: len(1.2), need: need(3.15, 3.0, 3.3), currentScale: 1, d1: 2 };
  assert.equal(checkDrop({ ...gap, d2: 5.0 }).verdict, 'fit');
  assert.equal(checkDrop({ ...gap, d2: 5.5 }).verdict, 'fit');
  assert.equal(checkDrop({ ...gap, d2: 4.98 }).verdict, 'tooSmall');
  assert.equal(checkDrop({ ...gap, d2: 5.52 }).verdict, 'tooBig');
  // Current scale: the key (12 cm at scale 2) needs k = ½.
  const key = { measure: { ...len(12), unit: 'cm' as const }, need: need(12), currentScale: 2, d1: 4 };
  assert.equal(checkDrop({ ...key, d2: 2 }).verdict, 'fit');
  assert.ok(near(checkDrop({ ...key, d2: 2 }).newScale, 1));
  assert.equal(checkDrop({ ...key, d2: 8 }).verdict, 'tooBig');
  assert.equal(checkDrop({ ...key, d2: 4 }).verdict, 'tooBig');
});

test('checkDrop: k vs k² vs k³ — the root, not the raw ratio', () => {
  const sky = { measure: area(0.24), need: need(2.16), currentScale: 1, d1: 1.5 };
  assert.ok(near(naiveK(sky.measure, sky.need), 9));
  assert.equal(checkDrop({ ...sky, d2: 1.5 * 3 }).verdict, 'fit');
  assert.equal(checkDrop({ ...sky, d2: 1.5 * 9 }).verdict, 'tooBig');
  const gold = { measure: weight(2), need: need(54), currentScale: 1, d1: 1.2 };
  assert.ok(near(naiveK(gold.measure, gold.need), 27));
  assert.equal(checkDrop({ ...gold, d2: 1.2 * 3 }).verdict, 'fit');
  assert.equal(checkDrop({ ...gold, d2: 1.2 * 27 }).verdict, 'tooBig');
  assert.equal(checkDrop({ ...gold, d2: 1.2 * Math.sqrt(27) }).verdict, 'tooBig');
  assert.equal(checkDrop({ ...gold, d2: 1.2 * 9 }).verdict, 'tooBig');
});

test('checkDrop: orientation only matters once the size is right; non-similar never fits', () => {
  const tri = { measure: { ...len(30), unit: 'cm' as const }, need: need(60), currentScale: 1, d1: 1.5 };
  assert.equal(checkDrop({ ...tri, d2: 3, orientationOk: false }).verdict, 'jam');
  assert.equal(checkDrop({ ...tri, d2: 3, orientationOk: true }).verdict, 'fit');
  assert.equal(checkDrop({ ...tri, d2: 3 }).verdict, 'fit');
  // Wrong size beats wrong orientation (the size is the louder mistake).
  assert.equal(checkDrop({ ...tri, d2: 4, orientationOk: false }).verdict, 'tooBig');
  assert.equal(checkDrop({ ...tri, d2: 2.25, orientationOk: false }).verdict, 'tooSmall');
  const rect = { measure: { ...area(50), unit: 'cm2' as const }, need: need(450), currentScale: 1, d1: 0.8 };
  for (const k of [0.5, 1, 2, 2.9, 3, 3.1, 4, 9]) {
    assert.equal(checkDrop({ ...rect, d2: 0.8 * k, similarShape: false }).verdict, 'noFit', `k = ${k}`);
  }
});

test('dropDistanceFor is k · d1', () => {
  assert.equal(dropDistanceFor(3, 2), 6);
  assert.equal(dropDistanceFor(0.25, 8), 2);
  assert.ok(near(dropDistanceFor(1.5, 2.4), 3.6));
});

test('proportion (AA): shadows, the laser triangle, nested triangles', () => {
  // Workbook real-life-similarity: 1.6 m person, 2 m shadow, 9 m tree shadow → 7.2 m.
  assert.ok(near(proportion(1.6, 2, 9), 7.2));
  // Level 7: 1 m pedestal 2 m from the source; wall 6 m away → 3 m.
  assert.ok(near(proportion(1, 2, 6), 3));
  // Level 10: banner 1.5 m at base 2; whole base 8 → 6 m. Using 6 instead of 8 gives 4.5.
  assert.ok(near(proportion(1.5, 2, 8), 6));
  assert.ok(near(proportion(1.5, 2, 6), 4.5));
  // Level 18: obelisk 1.5 m, 2 m shadow; tower shadow 12 → 9 m.
  assert.ok(near(proportion(1.5, 2, 12), 9));
});

test('powerName and fmt', () => {
  assert.equal(powerName(1), 'יחס אורכים');
  assert.equal(powerName(2), 'יחס שטחים');
  assert.equal(powerName(3), 'יחס נפחים');
  assert.equal(fmt(13.5), '13.5');
  assert.equal(fmt(2.625), '2.63');
  assert.equal(fmt(6.0), '6');
  assert.equal(fmt(1 / 3), '0.33');
});

const balanced = (s: string) => (s.match(/⟦/g) ?? []).length === (s.match(/⟧/g) ?? []).length;

test('explain (3rd failure): the used ratio, the ratio kind, the needed k, the root and which way to move', () => {
  // Area, the k = 9 skylight mistake.
  const m2 = area(0.24);
  const c2 = checkDrop({ measure: m2, need: need(2.16), currentScale: 1, d1: 1.5, d2: 13.5 });
  const l2 = explain(c2, m2, 1.5, 13.5, 3);
  assert.equal(l2.length, 5);
  assert.match(l2[0], /k = 13\.5 ÷ 1\.5 = 9/);
  assert.match(l2[1], /יחס שטחים/);
  assert.match(l2[2], /k = 3/);
  assert.match(l2[2], /k²/);
  assert.match(l2[3], /√9 = 3/);
  // The card says which way to move, not the exact d₂ (the retry still needs k · d₁).
  assert.match(l2[4], /קרוב יותר/);
  // Weight: cube root.
  const m3 = weight(2);
  const c3 = checkDrop({ measure: m3, need: need(54), currentScale: 1, d1: 1.2, d2: 6 });
  const l3 = explain(c3, m3, 1.2, 6, 3);
  assert.equal(l3.length, 5);
  assert.match(l3[3], /∛27 = 3/);
  assert.match(l3[4], /קרוב יותר/);
  // Length: no root line.
  const m1 = len(0.5);
  const c1 = checkDrop({ measure: m1, need: need(1.5), currentScale: 1, d1: 2, d2: 5 });
  const l1 = explain(c1, m1, 2, 5, 3);
  assert.equal(l1.length, 4);
  assert.match(l1[0], /k = 5 ÷ 2 = 2\.5/);
  assert.match(l1[1], /יחס אורכים/);
  assert.match(l1[2], /k = 3/);
  assert.ok(!l1.join(' ').includes('√'));
  assert.match(l1[3], /רחוק יותר/);
  // A range target (slack) states the window, not a single k.
  const cr = checkDrop({ measure: len(1.2), need: need(3.15, 3.0, 3.3), currentScale: 1, d1: 2, d2: 4.5 });
  const lr = explain(cr, len(1.2), 2, 4.5, 3);
  assert.match(lr[2], /בין/);
  assert.match(lr[2], /2\.5/);
  assert.match(lr[2], /2\.75/);
  for (const l of [...l1, ...l2, ...l3, ...lr]) assert.ok(balanced(l), `unbalanced LTR markers: ${l}`);
});

test('explain is progressive: the first card never gives the needed k', () => {
  const m2 = area(0.24);
  const c2 = checkDrop({ measure: m2, need: need(2.16), currentScale: 1, d1: 1.5, d2: 13.5 });
  const first = explain(c2, m2, 1.5, 13.5, 1);
  assert.equal(first.length, 2);
  assert.match(first[0], /k = 13\.5 ÷ 1\.5 = 9/);
  assert.match(first[1], /קרוב יותר/);
  assert.ok(!first.join(' ').includes('k = 3'));
  const second = explain(c2, m2, 1.5, 13.5, 2);
  assert.equal(second.length, 3);
  assert.match(second[1], /יחס שטחים/);
  assert.ok(!second.join(' ').includes('k = 3'));
});

test('explain: jam and noFit have their own short lines (no drop distance)', () => {
  const m = { ...len(30), unit: 'cm' as const };
  const jam = checkDrop({ measure: m, need: need(60), currentScale: 1, d1: 1.5, d2: 3, orientationOk: false });
  const lj = explain(jam, m, 1.5, 3);
  assert.equal(lj.length, 2);
  assert.match(lj[1], /צלע המתאימה/);
  const a = { ...area(50), unit: 'cm2' as const };
  const nf = checkDrop({ measure: a, need: need(450), currentScale: 1, d1: 0.8, d2: 2.4, similarShape: false });
  const ln = explain(nf, a, 0.8, 2.4);
  assert.equal(ln.length, 2);
  assert.match(ln[1], /לא דומה/);
  for (const l of [...lj, ...ln]) assert.ok(balanced(l), l);
});

test('starsFor: hints, alarms, failures and re-grabs', () => {
  const s = (hints = 0, alarms = 0, failures = 0, regrabs = 0) => starsFor({ hints, alarms, failures, regrabs });
  assert.equal(s(), 3);
  assert.equal(s(0, 0, 0, 1), 3, 'one re-grab is free');
  assert.equal(s(1), 2, 'a hint caps at 2');
  assert.equal(s(3), 2, 'hints count once');
  assert.equal(s(0, 1), 2);
  assert.equal(s(0, 0, 1), 2, 'a quiet failure (no alarm) still costs a star');
  assert.equal(s(0, 1, 1), 2, 'alarm + failure is the same mistake');
  assert.equal(s(0, 0, 0, 2), 2);
  assert.equal(s(1, 1), 1);
  assert.equal(s(0, 0, 2), 1, 'a second failed drop costs another star');
  assert.equal(starsFor({ hints: 0, alarms: 1, failures: 1, regrabs: 0, caught: 1 }), 1, 'getting caught instead of hiding costs a star');
  assert.equal(s(5, 5, 5, 5), 1, 'never below 1');
});

test('recap: the worked solution for each ratio kind', () => {
  assert.equal(recap(len(0.5), 1, need(1.5), 2), 'יחס אורכים: ⟦1.5 ÷ 0.5 = 3⟧ ← ⟦k = 3⟧ · ⟦d₂ = 3 × 2 = 6⟧');
  assert.equal(recap(area(0.24), 1, need(2.16), 1.2), 'יחס שטחים: ⟦2.16 ÷ 0.24 = 9⟧ ← ⟦k² = 9⟧ ← ⟦k = √9 = 3⟧ · ⟦d₂ = 3 × 1.2 = 3.6⟧');
  assert.equal(recap(weight(2), 1, need(16), 1.2), 'יחס נפחים: ⟦16 ÷ 2 = 8⟧ ← ⟦k³ = 8⟧ ← ⟦k = ∛8 = 2⟧ · ⟦d₂ = 2 × 1.2 = 2.4⟧');
  // An exhibit already enlarged × 2 (level 17): the ratio uses its current size.
  assert.equal(recap(len(0.12), 2, need(0.12), 3), 'יחס אורכים: ⟦0.12 ÷ 0.24 = 0.5⟧ ← ⟦k = 0.5⟧ · ⟦d₂ = 0.5 × 3 = 1.5⟧');
});
