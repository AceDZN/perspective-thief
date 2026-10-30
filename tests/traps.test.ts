// Wrong approaches lose, through the real sim: every drop below is a real grab from the pad, a real
// standing spot inside the room (found by the solver's findStand, never a teleport outside the
// walls), a real drop and the consequence it produces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, type Level, type V2 } from '../src/levels.ts';
import { checkDrop, type ConsequenceKind } from '../src/rules.ts';
import { localBounds, similarPolygons } from '../src/shapes.ts';
import { AIM_RANGE, Sim } from '../src/sim.ts';
import { aimAt, findStand, plan, playStep, settle, type PlanStep } from '../src/solver.ts';

const L = (id: number): Level => LEVELS[id - 1];

interface Outcome {
  /** No valid standing spot at that distance (outside the room, blocked, or beyond the lens range). */
  unreachable: boolean;
  solved: boolean;
  kind?: ConsequenceKind;
  d2: number;
}

/** A sim where every target before `idx` is already solved correctly. */
function simBefore(level: Level, idx: number): { sim: Sim; steps: PlanStep[] } {
  const steps = plan(level);
  const sim = new Sim(level);
  // These tests are about ratios, not stealth: park the finale's patrol guard at his door,
  // facing the wall (he only moves when the player walks, and teleports aren't walking).
  if (level.patrol) {
    sim.guard.pos = [...level.guardDoor] as V2;
    sim.guard.yaw = 0;
  }
  for (let i = 0; i < idx; i++) {
    playStep(sim, steps[i]);
    assert.ok(sim.solved.has(steps[i].target.id), `setup: level ${level.id} ${steps[i].target.id}`);
  }
  return { sim, steps };
}

/** A real standing spot at floor distance d from the target (as the solver plans it, carrying). */
function standAt(sim: Sim, step: PlanStep, d: number): V2 | null {
  if (d > AIM_RANGE) return null;
  const save = sim.carry;
  sim.carry = { exId: step.exId, d1: step.d1, grab3d: 1, fromPad: true };
  const p = findStand(sim, step.target, d, step.pad);
  sim.carry = save;
  return p;
}

/** Grab from the pad, walk to a real spot at distance d2, drop, settle. */
function dropAt(level: Level, idx: number, d2: number, opts: { exId?: string; rotate?: boolean; turns?: number } = {}): Outcome {
  const { sim, steps } = simBefore(level, idx);
  let step = steps[idx];
  if (opts.exId) {
    const pad = level.pads.find((p) => p.forId === opts.exId)!;
    step = { ...step, exId: opts.exId, pad: pad.pos, d1: pad.d };
  }
  const stand = standAt(sim, step, d2);
  if (!stand) return { unreachable: true, solved: false, d2 };
  const before = sim.events.length;
  if (opts.turns !== undefined) {
    // Manual: grab, rotate `turns` times, walk, drop.
    sim.player.x = step.pad[0];
    sim.player.z = step.pad[1];
    const ex = sim.ex(step.exId)!;
    const b = sim.exBox(ex);
    aimAt(sim, [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]);
    assert.ok(sim.grab());
    for (let i = 0; i < opts.turns; i++) sim.rotate();
    sim.player.x = stand[0];
    sim.player.z = stand[1];
    aimAt(sim, step.target.zone.c);
    sim.drop();
    settle(sim);
  } else {
    playStep(sim, { ...step, stand, d2 }, undefined, opts.rotate ?? true);
  }
  const fails = sim.events.slice(before).filter((e) => e.type === 'fail');
  const kind = fails.length ? (fails[fails.length - 1] as { kind: ConsequenceKind }).kind : undefined;
  // The drop really happened at d2 (not refused by the lens).
  const drops = sim.events.slice(before).filter((e) => e.type === 'drop') as { d2: number }[];
  assert.equal(drops.length, 1, `level ${level.id}: the drop at ${d2.toFixed(2)} m was refused`);
  assert.ok(Math.abs(drops[0].d2 - d2) < 1e-6);
  return { unreachable: false, solved: sim.solved.has(step.target.id), kind, d2 };
}

/** The farthest real standing spot from a target (0.05 m steps from the lens range down). */
function farthest(level: Level, idx: number): number {
  const { sim, steps } = simBefore(level, idx);
  for (let d = AIM_RANGE; d > 0.6; d -= 0.05) if (standAt(sim, steps[idx], d)) return d;
  throw new Error('no stand at all');
}

const loses = (o: Outcome, msg: string) => {
  assert.ok(!o.unreachable, `${msg}: unreachable at ${o.d2.toFixed(2)} m`);
  assert.equal(o.solved, false, `${msg}: won at ${o.d2.toFixed(2)} m`);
  assert.ok(o.kind, `${msg}: no consequence`);
};

const ALL = LEVELS.flatMap((level) => plan(level).map((s, idx) => ({ level, idx, s, key: `${level.id}:${s.target.id}` })));

test('sanity: the correct drop through these helpers wins every target', () => {
  for (const { level, idx, s, key } of ALL) {
    const o = dropAt(level, idx, s.d2);
    assert.ok(o.solved, key);
  }
});

// ───────────── k vs k² ─────────────

test('k-vs-k² trap, level 12: k = 9 (the area ratio) crashes through the roof', () => {
  const s = plan(L(12))[0];
  assert.ok(Math.abs(s.k - 3) < 1e-9);
  const o = dropAt(L(12), 0, 9 * s.d1); // 13.5 m — a real spot in the room
  loses(o, 'level 12 k = 9');
  assert.equal(o.kind, 'roofCrash');
});

test('k-vs-k² trap, levels 13, 15 and the finale banner: using the area ratio as k fails', () => {
  const o13 = dropAt(L(13), 0, 4 * plan(L(13))[0].d1); // k = 4 instead of 2
  loses(o13, 'level 13 k = 4');
  assert.equal(o13.kind, 'crash');
  const o15 = dropAt(L(15), 0, 9 * plan(L(15))[0].d1); // k = 9 instead of 3
  loses(o15, 'level 15 k = 9');
  assert.equal(o15.kind, 'crash');
  const o18 = dropAt(L(18), 1, 9 * plan(L(18))[1].d1); // billboard, k = 9 instead of 3 (13.5 m)
  loses(o18, 'level 18 billboard k = 9');
  assert.equal(o18.kind, 'crash');
});

test('k-vs-k² trap, level 14: the mat with k = 16 is out of reach; the pure rule and the farthest real drop both fail', () => {
  const lvl = L(14);
  const s = plan(lvl)[1];
  assert.equal(s.target.id, 'plate');
  const d2 = 16 * s.d1; // 24 m
  assert.ok(d2 > AIM_RANGE);
  const ex = lvl.exhibits.find((e) => e.id === 'mat')!;
  assert.equal(checkDrop({ measure: ex.measures.area, need: s.target.need, currentScale: 1, d1: s.d1, d2 }).verdict, 'tooBig');
  const far = farthest(lvl, 1);
  const o = dropAt(lvl, 1, far);
  loses(o, `level 14 farthest ${far.toFixed(2)} m`);
  assert.equal(o.kind, 'crash');
  // And the reverse confusion on the perimeter target (k = √2 instead of 2) fails too.
  loses(dropAt(lvl, 0, Math.SQRT2 * plan(lvl)[0].d1), 'level 14 loop k = √2');
});

test('reverse trap: perimeter treated like area (k = √ratio) fails on levels 11 and 18', () => {
  loses(dropAt(L(11), 0, Math.sqrt(3) * plan(L(11))[0].d1), 'level 11 k = √3');
  loses(dropAt(L(18), 2, Math.sqrt(2.5) * plan(L(18))[2].d1), 'level 18 loop k = √2.5');
});

// ───────────── k³ ─────────────

test('k³ trap, level 16: k = √27 and k = 9 fail; k = 27 is beyond the lens and the farthest real drop crashes', () => {
  const lvl = L(16);
  const s = plan(lvl)[0];
  loses(dropAt(lvl, 0, Math.sqrt(27) * s.d1), 'level 16 k = √27');
  loses(dropAt(lvl, 0, 9 * s.d1), 'level 16 k = 9');
  const d27 = 27 * s.d1; // 32.4 m
  assert.ok(d27 > AIM_RANGE, 'k = 27 needs 32.4 m: the lens refuses beyond 16 m');
  const gold = lvl.exhibits[0];
  assert.equal(checkDrop({ measure: gold.measures.weight, need: s.target.need, currentScale: 1, d1: s.d1, d2: d27 }).verdict, 'tooBig');
  // If it could be reached, a 27× cube (5.4 m) would go through the 4 m vault ceiling.
  assert.ok(localBounds(gold.shape, 27).max[1] > lvl.room.h);
  const far = farthest(lvl, 0);
  const o = dropAt(lvl, 0, far);
  loses(o, `level 16 farthest ${far.toFixed(2)} m`);
  assert.equal(o.kind, 'crash');
});

// ───────────── 1/k ─────────────

test('1/k trap, level 2: inverting the ratio (k = 4, d₂ = 32 m) or dropping farther to "shrink" fails', () => {
  const lvl = L(2);
  const s = plan(lvl)[0];
  const ex = lvl.exhibits[0];
  assert.equal(checkDrop({ measure: ex.measures.height, need: s.target.need, currentScale: 1, d1: s.d1, d2: 4 * s.d1 }).verdict, 'tooBig');
  assert.equal(standAt(new Sim(lvl), s, 32), null, '32 m is not a real spot');
  const far = farthest(lvl, 0);
  for (const d2 of [far, 12, 9, 8, 4]) {
    const o = dropAt(lvl, 0, d2);
    loses(o, `level 2 d₂ = ${d2}`);
    assert.equal(o.kind, 'crash', `level 2 d₂ = ${d2}`);
  }
});

test('1/k trap, level 17: dropping at 2 × grab (k = 2) or at the grab distance (k = 1) fails; ½ wins', () => {
  const lvl = L(17);
  const s = plan(lvl)[0];
  assert.equal(s.d1, 3);
  // Subtracting the enlargement (d₁ − 2) must not land on the answer either.
  loses(dropAt(lvl, 0, s.d1 - 2), 'level 17 d₁ − 2');
  const o2 = dropAt(lvl, 0, 2 * s.d1);
  loses(o2, 'level 17 k = 2');
  assert.equal(o2.kind, 'crash');
  loses(dropAt(lvl, 0, s.d1), 'level 17 k = 1');
  assert.ok(dropAt(lvl, 0, s.d1 / 2).solved);
});

// ───────────── d₂ − d₁ instead of d₂ ÷ d₁ ─────────────

// Targets where d₁ + k happens to equal k · d₁ (d₁ = k / (k − 1)): the additive rule wins there.
// Reported to the lead as a level-design weakness; this list may only shrink.
const ADDITIVE_COINCIDENCES = new Set<string>([]);

test('d₂ − d₁ misconception (drop at d₁ + k) fails wherever it differs from k · d₁', () => {
  const coincide: string[] = [];
  for (const { level, idx, s, key } of ALL) {
    const dAdd = s.d1 + s.k;
    const kAdd = dAdd / s.d1;
    if (kAdd >= s.kMin - 1e-9 && kAdd <= s.kMax + 1e-9) {
      coincide.push(key);
      continue;
    }
    loses(dropAt(level, idx, dAdd), `${key} d₂ = d₁ + k = ${dAdd}`);
  }
  for (const c of coincide) assert.ok(ADDITIVE_COINCIDENCES.has(c), `new additive coincidence: ${c}`);
  // Level 1 is the level that names this misconception: it must fail there.
  assert.ok(!coincide.includes('1:niche'));
});

test('additive-height misconception (move as many metres as the size grows) fails on levels 1 and 4', () => {
  // Level 1: the cube grows by 1 m (0.5 → 1.5) → step back 1 m: d₂ = 3.
  loses(dropAt(L(1), 0, 2 + 1), 'level 1 d₂ = 3');
  // Level 4: the bust grows by 0.3 m → d₂ = 2.4 + 0.3 = 2.7 → pocketed.
  const o = dropAt(L(4), 0, 2.4 + 0.3);
  loses(o, 'level 4 d₂ = 2.7');
  assert.equal(o.kind, 'pocketed');
});

// ───────────── non-corresponding sides ─────────────

test('level 5: matching the statue height to the doorway (k = 3/0.8) leaves a gap; matching it to the ceiling crashes', () => {
  const s = plan(L(5))[0];
  const o = dropAt(L(5), 0, (3 / 0.8) * s.d1); // 5.625 m
  loses(o, 'level 5 height → doorway');
  assert.equal(o.kind, 'gapLeft');
  loses(dropAt(L(5), 0, (3.5 / 0.8) * s.d1), 'level 5 height → ceiling');
});

test('level 8: the right k in the wrong orientation jams; base-to-base (40 → 60) is too small', () => {
  const lvl = L(8);
  const s = plan(lvl)[0];
  const noRotate = dropAt(lvl, 0, s.d2, { rotate: false }); // the 40 side still on the base
  loses(noRotate, 'level 8 not rotated');
  assert.equal(noRotate.kind, 'jam');
  const once = dropAt(lvl, 0, s.d2, { turns: 1 }); // the 50 side on the base
  loses(once, 'level 8 rotated once');
  assert.equal(once.kind, 'jam');
  assert.ok(dropAt(lvl, 0, s.d2, { turns: 2 }).solved, 'two turns put the 30 side on the base');
  const baseToBase = dropAt(lvl, 0, 1.5 * s.d1, { rotate: false });
  loses(baseToBase, 'level 8 k = 60/40');
  assert.equal(baseToBase.kind, 'fallThrough');
});

test('levels 6, 7, 10: mismatched sides in the triangle step fail', () => {
  // 6: ladder vs the statue's shadow (k = 9/1.8 = 5); inverted proportion (h = 9·2/1.6 = 11.25 → roof).
  loses(dropAt(L(6), 0, 5 * 1.5), 'level 6 k = 5');
  const inv = dropAt(L(6), 0, (11.25 / 1.8) * 1.5);
  loses(inv, 'level 6 inverted proportion');
  assert.equal(inv.kind, 'roofCrash');
  // 7: additive 1 + (6 − 2) = 5 m mirror → k = 10.
  loses(dropAt(L(7), 0, 10 * 1), 'level 7 k = 10');
  // 10: banner-to-wall 6 instead of the whole base 8 → height 4.5 → k = 3.75.
  const o10 = dropAt(L(10), 0, (4.5 / 1.2) * 1);
  loses(o10, 'level 10 base 6');
  assert.equal(o10.kind, 'tooShort');
});

test('level 9: matching the ramp base to the balcony height (k = 0.75) fails; too long a ramp crashes', () => {
  const s = plan(L(9))[0];
  loses(dropAt(L(9), 0, 0.75 * s.d1), 'level 9 k = 0.75');
  const long = dropAt(L(9), 0, 3.5 * s.d1);
  loses(long, 'level 9 k = 3.5');
  assert.equal(long.kind, 'crash');
});

// ───────────── not similar ─────────────

test('level 15: the 10 × 5 rectangle never fits the house-pentagon frame, for any k', () => {
  const lvl = L(15);
  const penta = lvl.exhibits.find((e) => e.id === 'penta')!;
  const rect = lvl.exhibits.find((e) => e.id === 'rect')!;
  assert.ok(penta.shape.type === 'poly' && rect.shape.type === 'poly');
  const shoelace = (p: V2[]) => Math.abs(p.reduce((s, q, i) => s + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0)) / 2;
  // The placards are true: both 50 cm², the pentagon's vertical edge is 4 cm.
  assert.ok(Math.abs(shoelace(penta.shape.pts) * 1e4 - 50) < 1e-9);
  assert.ok(Math.abs(shoelace(rect.shape.pts) * 1e4 - 50) < 1e-9);
  assert.ok(Math.abs((penta.shape.pts[2][1] - penta.shape.pts[1][1]) * 100 - 4) < 1e-9);
  const big = penta.shape.pts.map(([x, y]) => [x * 3, y * 3] as V2);
  assert.ok(Math.abs(shoelace(big) * 1e4 - 450) < 1e-9, '× 3 → 450 cm²');
  assert.ok(similarPolygons(penta.shape.pts, big));
  assert.ok(!similarPolygons(penta.shape.pts, rect.shape.pts));
  let tried = 0;
  for (const k of [0.75, 1, 1.5, 2, 2.5, 2.9, 3, 3.1, 3.5, 4, 5, 6, 9, 12]) {
    const o = dropAt(lvl, 0, 0.8 * k, { exId: 'rect' });
    if (o.unreachable) continue;
    tried++;
    loses(o, `level 15 rectangle k = ${k}`);
    assert.equal(o.kind, 'noFit');
  }
  assert.ok(tried >= 12, `only ${tried} reachable trials`);
});

// ───────────── eyeballing ─────────────

test('eyeballing: k off by ±5 % or ±10 % fails on every ±2 % target', () => {
  let n = 0;
  for (const { level, idx, s, key } of ALL) {
    if (s.target.need.min !== undefined || s.target.need.max !== undefined) continue;
    for (const p of [-0.1, -0.05, 0.05, 0.1]) {
      const d2 = s.d2 * (1 + p);
      const o = dropAt(level, idx, d2);
      if (o.unreachable) {
        // Only possible past the lens range; then the pure rule must reject it.
        assert.ok(d2 > AIM_RANGE, `${key} ${p}: no stand at ${d2.toFixed(2)} m`);
        continue;
      }
      loses(o, `${key} ${p > 0 ? '+' : ''}${p * 100}%`);
      n++;
    }
  }
  assert.equal(n, 19 * 4, 'all 19 default-tolerance targets × 4 offsets played');
});

test('eyeballing, physical slack: level 3 (±4.8 % window) rejects ±5 % and ±10 %; level 2 (±6.7 %) rejects ±10 %', () => {
  const s3 = plan(L(3))[0];
  assert.ok(Math.abs(s3.kMin - 2.5) < 1e-9 && Math.abs(s3.kMax - 2.75) < 1e-9);
  for (const p of [-0.1, -0.05, 0.05, 0.1]) loses(dropAt(L(3), 0, s3.d2 * (1 + p)), `level 3 ${p}`);
  for (const k of [2.5, 2.6, 2.7, 2.75]) assert.ok(dropAt(L(3), 0, k * s3.d1).solved, `level 3 k = ${k}`);
  const s2 = plan(L(2))[0];
  assert.ok(Math.abs(s2.kMin - 0.7 / 3) < 1e-9 && Math.abs(s2.kMax - 0.8 / 3) < 1e-9);
  for (const p of [-0.1, 0.1]) {
    const o = dropAt(L(2), 0, s2.d2 * (1 + p));
    loses(o, `level 2 ${p}`);
    assert.equal(o.kind, p > 0 ? 'crash' : 'blownAway');
  }
  // Documented: ±5 % is inside the vent's ±0.05 m slack (the handoff's "snug ±0.05 m").
  for (const p of [-0.05, 0.05]) assert.ok(dropAt(L(2), 0, s2.d2 * (1 + p)).solved, `level 2 ${p} is within the slack`);
});

// ───────────── constant strategies ─────────────

const CONSTANTS = [1, 1.5, 2, 2.5, 3, 4];

test('constant strategies: dropping at a fixed multiple of the grab distance wins only a minority of targets', () => {
  const total = ALL.length;
  assert.equal(total, 21);
  const table: Record<string, string[]> = {};
  for (const c of CONSTANTS) {
    const won: string[] = [];
    for (const { level, idx, s, key } of ALL) {
      const o = dropAt(level, idx, c * s.d1);
      // Unreachable (e.g. level 2 × 4 = 32 m) means the strategy cannot even be played there: a loss.
      if (o.solved) won.push(key);
    }
    table[c] = won;
    assert.ok(won.length / total < 0.4, `k = ${c} wins ${won.length}/${total}: ${won.join(', ')}`);
  }
  // The exact winners (so a change that makes a constant stronger is noticed).
  assert.deepEqual(table, {
    1: [],
    1.5: ['4:plinth'],
    2: ['8:frame', '13:plate', '14:loop'],
    2.5: ['3:gap', '18:loop'],
    3: ['1:niche', '9:balcony', '11:loop', '12:window', '15:frame', '16:elevator', '18:billboard'],
    4: ['5:door', '6:crown', '14:plate'],
  });
});

test('constant strategies: no fixed multiple wins more than a third of the levels; none wins a multi-target level', () => {
  for (const c of CONSTANTS) {
    const levelsWon: number[] = [];
    for (const level of LEVELS) {
      const steps = plan(level);
      const sim = new Sim(level);
      let all = true;
      for (const [i, s] of steps.entries()) {
        const { sim: probe } = simBefore(level, i);
        const stand = standAt(probe, s, c * s.d1);
        if (!stand) { all = false; break; } // cannot be played there: a loss
        playStep(sim, { ...s, stand, d2: c * s.d1 });
        if (!sim.solved.has(s.target.id)) { all = false; break; }
      }
      if (all) levelsWon.push(level.id);
    }
    assert.ok(levelsWon.length <= 6, `k = ${c} wins levels ${levelsWon.join(', ')}`);
    for (const id of levelsWon) assert.equal(plan(L(id)).length, 1, `k = ${c} wins multi-target level ${id}`);
    if (c === 2) assert.deepEqual(levelsWon, [8, 13], '"drop at 2 × grab" wins only levels 8 and 13');
  }
});
