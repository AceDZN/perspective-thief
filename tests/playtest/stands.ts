// Offline map knowledge for the playtest robot (no game state touched): for every target, a free
// standing direction at each drop distance, plus a table of which naive strategies land in the window.
//   npx tsx tests/playtest/stands.ts > test-output/playtest/stands.json
import { LEVELS } from '../../src/levels.ts';
import { Sim } from '../../src/sim.ts';
import { findStand, targetOrder } from '../../src/solver.ts';
import { kWindow, scaledMeasure } from '../../src/rules.ts';

const stands: Record<string, Record<string, [number, number] | null>> = {};
const table: unknown[] = [];
for (const L of LEVELS) {
  const sim = new Sim(L);
  for (const t of targetOrder(L)) {
    const ex = L.exhibits.find((e) => e.id === t.accepts)!;
    const pad = L.pads.find((p) => p.forId === ex.id)!;
    sim.carry = { exId: ex.id, d1: pad.d, grab3d: 1, fromPad: true };
    const key = `${L.id}:${t.id}`;
    stands[key] = {};
    for (let d = 0.6; d <= 16.001; d += 0.1) stands[key][d.toFixed(1)] = findStand(sim, t, d, pad.pos);
    sim.carry = null;
    sim.solved.add(t.id);
    const m = ex.measures[t.measure];
    const w = kWindow(m, t.need, ex.initialScale ?? 1);
    const naive = t.need.value / scaledMeasure(m, ex.initialScale ?? 1); // ratio of the two numbers on the plates
    const strategies: Record<string, number> = {
      'x1.5': 1.5, x2: 2, 'x2.5': 2.5, x3: 3, x4: 4,
      'd1+k (additive)': (pad.d + w.k) / pad.d,
      'plate ratio as k (ignores power)': naive,
    };
    const wins = Object.entries(strategies).filter(([, k]) => k >= w.kMin - 1e-9 && k <= w.kMax + 1e-9).map(([n]) => n);
    table.push({ level: L.id, target: t.id, power: m.power, d1: pad.d, k: +w.k.toFixed(4), window: [+(w.kMin * pad.d).toFixed(3), +(w.kMax * pad.d).toFixed(3)], wins });
  }
}
console.log(JSON.stringify({ stands, table }));
