import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel, verifyGenerated } from '../src/generator.ts';
import { checkDrop } from '../src/rules.ts';
import { Sim } from '../src/sim.ts';
import { plan, playStep } from '../src/solver.ts';

for (const world of [1, 2, 3, 4]) {
  test(`challenge rooms in hall ${world}: 25 seeds, all solvable through the sim, drop-at-2x never wins`, () => {
    const templates = new Set<number>();
    for (let seed = 1; seed <= 25; seed++) {
      const L = generateLevel(world, seed * 7919);
      templates.add(Math.floor(-L.id / 1000));
      assert.ok(L.id < 0, 'generated rooms have negative ids');
      assert.ok(verifyGenerated(L), `seed ${seed}`);
      const sim = new Sim(L);
      for (const s of plan(L)) {
        const ex = L.exhibits.find((e) => e.id === s.exId)!;
        assert.notEqual(checkDrop({ measure: ex.measures[s.target.measure], need: s.target.need, currentScale: ex.initialScale ?? 1, d1: s.d1, d2: 2 * s.d1 }).verdict, 'fit');
        playStep(sim, s);
        assert.ok(sim.solved.has(s.target.id), `hall ${world} seed ${seed}: ${s.target.id} (k=${s.k})`);
      }
    }
    // Each hall draws on more than one template.
    assert.ok(templates.size >= (world === 1 || world === 2 || world === 3 || world === 4 ? 2 : 1), `hall ${world} templates ${[...templates]}`);
  });
}
