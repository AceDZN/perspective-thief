import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../src/levels.ts';
import { Sim } from '../src/sim.ts';
import { plan, playStep, settle, aimAt } from '../src/solver.ts';

test('there are 18 levels with unique ids 1..18', () => {
  assert.equal(LEVELS.length, 18);
  assert.deepEqual(LEVELS.map((l) => l.id), Array.from({ length: 18 }, (_, i) => i + 1));
});

for (const level of LEVELS) {
  test(`level ${level.id} (${level.title}) is solvable through the sim and its exit`, () => {
    const steps = plan(level);
    const sim = new Sim(level);
    for (const s of steps) {
      assert.ok(s.stand, `level ${level.id}: no standing spot at d2=${s.d2.toFixed(2)} for ${s.target.id}`);
      playStep(sim, s);
      assert.ok(sim.solved.has(s.target.id), `level ${level.id}: ${s.target.id} not solved (phase ${sim.phase}, failure ${sim.failure?.kind})`);
    }
    // Walk out: teleport next to the exit at its height, then step in.
    const e = level.exit;
    sim.player.x = e.pos[0];
    sim.player.z = e.pos[2];
    sim.player.y = e.pos[1];
    sim.step(1 / 60);
    assert.equal(sim.phase, 'won', `level ${level.id} not won at exit`);
    assert.equal(sim.stars, 3);
  });
}

test('level 1 numbers: grab at 2 m, drop at 6 m (k = 3)', () => {
  const s = plan(LEVELS[0])[0];
  assert.equal(s.d1, 2);
  assert.ok(Math.abs(s.k - 3) < 1e-9);
  assert.ok(Math.abs(s.d2 - 6) < 1e-9);
});

test('handoff drop distances', () => {
  const want: Record<number, number[]> = { 1: [6], 2: [2], 4: [3.6], 5: [6], 6: [6], 7: [6], 8: [3], 10: [5], 11: [6], 12: [3.6], 13: [3], 14: [3, 6], 15: [2.4], 16: [3.6], 17: [1.5], 18: [6, 3.6, 5] };
  for (const [id, ds] of Object.entries(want)) {
    const p = plan(LEVELS[Number(id) - 1]);
    assert.deepEqual(p.map((s) => Math.round(s.d2 * 1000) / 1000), ds, `level ${id}`);
  }
});

test('level 3 accepts the whole 5.0–5.5 m band and rejects outside it', () => {
  const lvl = LEVELS[2];
  for (const [d2, ok] of [[5.02, true], [5.25, true], [5.48, true], [4.9, false], [5.6, false]] as const) {
    const sim = new Sim(lvl);
    playStep(sim, plan(lvl)[0], d2);
    assert.equal(sim.solved.has('gap'), ok, `d2=${d2}`);
  }
});

test('a wrong drop never wins and the exhibit respawns on its pedestal', () => {
  const lvl = LEVELS[0];
  const sim = new Sim(lvl);
  const s = plan(lvl)[0];
  playStep(sim, s, 4.5);
  assert.equal(sim.solved.size, 0);
  const ex = sim.ex('cube')!;
  assert.equal(ex.state, 'pedestal');
  assert.equal(ex.scale, 1);
  assert.equal(sim.stats.failures, 1);
});

test('the guard chase ends by hiding in the sarcophagus', () => {
  const lvl = LEVELS[0];
  const sim = new Sim(lvl);
  const s = plan(lvl)[0];
  playStep(sim, s, 7); // k = 3.5 → too big → crash + alarm
  // settle() stops at play/explain; drive the chase manually.
  const sim2 = new Sim(lvl);
  const ex = sim2.ex('cube')!;
  sim2.player.x = s.pad[0];
  sim2.player.z = s.pad[1];
  const b = sim2.exBox(ex);
  aimAt(sim2, [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]);
  assert.ok(sim2.grab());
  const a = s.target.anchor;
  sim2.player.x = a[0];
  sim2.player.z = a[2] + 7;
  aimAt(sim2, s.target.zone.c);
  sim2.drop();
  for (let i = 0; i < 200 && sim2.phase !== 'chase'; i++) sim2.step(1 / 60);
  assert.equal(sim2.phase, 'chase');
  assert.equal(sim2.failure?.kind, 'crash');
  const h = lvl.hides[0];
  sim2.player.x = h[0];
  sim2.player.z = h[1];
  sim2.step(1 / 60);
  assert.equal(sim2.phase, 'hidden');
  settle(sim2);
  assert.equal(sim2.phase, 'play');
  assert.equal(sim2.stats.alarms, 1);
  void sim;
});

test('a drop anywhere but a target sends the exhibit back to its pedestal at its starting size', () => {
  const lvl = LEVELS[0];
  const sim = new Sim(lvl);
  const s = plan(lvl)[0];
  sim.player.x = s.pad[0];
  sim.player.z = s.pad[1];
  const ex = sim.ex('cube')!;
  const b = sim.exBox(ex);
  aimAt(sim, [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]);
  assert.ok(sim.grab());
  // Aim at open floor 3 m ahead (k = 1.5 on the floor would be a free size preview).
  sim.player.x = 2;
  sim.player.z = 4;
  aimAt(sim, [2, 0, 1]);
  assert.equal(sim.aim.kind, 'floor');
  sim.drop();
  settle(sim);
  assert.equal(ex.state, 'pedestal');
  assert.equal(ex.scale, 1);
  assert.deepEqual(ex.pos, [lvl.exhibits[0].pos[0], lvl.exhibits[0].pedestal, lvl.exhibits[0].pos[1]]);
  assert.equal(sim.stats.failures, 0);
});

test('after a crash at the drop spot, a hide spot is always reachable well before the guard (≥ 1.5 s head start)', async () => {
  const { WALK, GUARD_CHASE } = await import('../src/sim.ts');
  for (const level of LEVELS) {
    for (const s of plan(level)) {
      const st = s.stand!;
      const margin = Math.max(...level.hides.map((h) => Math.hypot(h[0] - level.guardDoor[0], h[1] - level.guardDoor[1]) / GUARD_CHASE - (Math.hypot(h[0] - st[0], h[1] - st[1]) / WALK + 1.0)));
      assert.ok(margin >= 1.5, `level ${level.id} ${s.target.id}: head start ${margin.toFixed(2)} s`);
    }
  }
});
