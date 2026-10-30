// Level solver: finds, for every target, the exact k, the drop distance from the grab pad and a
// real standing spot in the room. Used by tests (every level solvable) and the replay generator.
import type { Level, Target, V2, V3 } from './levels.ts';
import { kWindow } from './rules.ts';
import { EYE, NO_INPUT, Sim } from './sim.ts';

export interface PlanStep {
  target: Target;
  exId: string;
  pad: V2;
  d1: number;
  k: number;
  kMin: number;
  kMax: number;
  d2: number;
  stand: V2 | null;
}

export function aimAt(sim: Sim, p: V3): void {
  const e = sim.eye();
  const dx = p[0] - e[0], dy = p[1] - e[1], dz = p[2] - e[2];
  sim.player.yaw = Math.atan2(-dx, -dz);
  sim.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  sim.updateAim();
}

/** Targets in an order that respects `requires`. */
export function targetOrder(level: Level): Target[] {
  const out: Target[] = [];
  const left = [...level.targets];
  while (left.length) {
    const i = left.findIndex((t) => !t.requires || out.some((o) => o.id === t.requires));
    if (i < 0) throw new Error(`level ${level.id}: circular requires`);
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

/** Find a free standing spot at horizontal distance d from the target anchor that can aim at it. */
export function findStand(sim: Sim, target: Target, d: number, prefer?: V2): V2 | null {
  const a = target.anchor;
  const cands: { p: V2; score: number }[] = [];
  for (let deg = 0; deg < 360; deg += 2) {
    const th = (deg * Math.PI) / 180;
    const p: V2 = [a[0] + Math.sin(th) * d, a[2] + Math.cos(th) * d];
    const score = prefer ? Math.hypot(p[0] - prefer[0], p[1] - prefer[1]) : deg;
    cands.push({ p, score });
  }
  cands.sort((x, y) => x.score - y.score);
  const save = { ...sim.player };
  for (const { p } of cands) {
    if (sim.inPit(p[0], p[1])) continue;
    if (sim.blocked(p[0], p[1], 0)) continue;
    if (sim.groundAt(p[0], p[1], 0) !== 0) continue;
    sim.player.x = p[0];
    sim.player.z = p[1];
    sim.player.y = 0;
    aimAt(sim, target.zone.c);
    if (sim.aim.kind === 'target' && sim.aim.id === target.id && sim.aim.valid) {
      Object.assign(sim.player, save);
      return p;
    }
  }
  Object.assign(sim.player, save);
  return null;
}

/** Build the plan for a level (does not change the sim). */
export function plan(level: Level): PlanStep[] {
  const sim = new Sim(level);
  const steps: PlanStep[] = [];
  for (const t of targetOrder(level)) {
    const ex = level.exhibits.find((e) => e.id === t.accepts)!;
    const pad = level.pads.find((p) => p.forId === ex.id)!;
    const w = kWindow(ex.measures[t.measure], t.need, ex.initialScale ?? 1);
    const d2 = w.k * pad.d;
    // Carry state matters for aiming at targets.
    sim.carry = { exId: ex.id, d1: pad.d, grab3d: 1, fromPad: true };
    const stand = findStand(sim, t, d2, pad.pos);
    sim.carry = null;
    steps.push({ target: t, exId: ex.id, pad: pad.pos, d1: pad.d, k: w.k, kMin: w.kMin, kMax: w.kMax, d2, stand });
    sim.solved.add(t.id);
  }
  return steps;
}

/** Grab from the pad, stand at the spot, drop, settle. Returns the sim. Teleports, like a test harness. */
export function playStep(sim: Sim, step: PlanStep, d2Override?: number, rotateToMatch = true): void {
  const ex = sim.ex(step.exId)!;
  sim.player.x = step.pad[0];
  sim.player.z = step.pad[1];
  sim.player.y = 0;
  const b = sim.exBox(ex);
  aimAt(sim, [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]);
  if (!sim.grab()) throw new Error(`level ${sim.level.id}: could not grab ${step.exId} (aim ${sim.aim.kind} ${sim.aim.id})`);
  if (step.target.orientation !== undefined && rotateToMatch) {
    for (let i = 0; i < 3 && ex.orientation !== step.target.orientation; i++) sim.rotate();
  }
  let stand = step.stand!;
  if (d2Override !== undefined) {
    const a = step.target.anchor;
    const dx = stand[0] - a[0], dz = stand[1] - a[2];
    const len = Math.hypot(dx, dz);
    stand = [a[0] + (dx / len) * d2Override, a[2] + (dz / len) * d2Override];
  }
  sim.player.x = stand[0];
  sim.player.z = stand[1];
  sim.player.y = 0;
  aimAt(sim, step.target.zone.c);
  sim.drop();
  settle(sim);
}

/** Step until the sim is back in play (or explain/won), resolving chases by standing still. */
export function settle(sim: Sim, maxSeconds = 30): void {
  for (let i = 0; i < maxSeconds * 60; i++) {
    if (sim.phase === 'play' || sim.phase === 'won') return;
    if (sim.phase === 'explain') {
      sim.step(1 / 60, { ...NO_INPUT, act: true });
      continue;
    }
    sim.step(1 / 60, NO_INPUT);
  }
}

export function eyeHeight(): number {
  return EYE;
}
