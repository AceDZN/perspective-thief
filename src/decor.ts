// Display cases along the walls: pure placement shared by the sim (colliders) and the scene.
// Cases stay clear of everything the player needs (targets, exhibits, pads, rulers, hides, exits).
import type { Level, V2 } from './levels.ts';

export interface DecorCase {
  pos: V2;
  /** Rotation so the case's front faces into the room. */
  yaw: number;
  item: 'vase' | 'bust' | 'gem';
}

export const CASE_HALF = 0.4;
export const CASE_H = 1.9;

function segDist(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
}

export function decorCases(level: Level): DecorCase[] {
  const R = level.room;
  if (R.theme === 'rooftop') return [];
  const keep: V2[] = [
    level.spawn.pos,
    level.guardDoor,
    [level.exit.pos[0], level.exit.pos[2]],
    ...level.hides,
    ...level.pads.map((p) => p.pos),
    ...level.exhibits.map((e) => e.pos),
    ...level.targets.map((t) => [t.anchor[0], t.anchor[2]] as V2),
  ];
  const segs: [V2, V2][] = [];
  for (const r of level.rulers) {
    const a: V2 = [r.origin[0] + Math.sin(r.dir) * r.from, r.origin[1] + Math.cos(r.dir) * r.from];
    const b: V2 = [r.origin[0] + Math.sin(r.dir) * r.to, r.origin[1] + Math.cos(r.dir) * r.to];
    segs.push([a, b]);
  }
  // Every target's line of sight from its solver distance band is kept clear by avoiding the
  // straight line between each target and each pad.
  for (const t of level.targets) for (const p of level.pads) segs.push([[t.anchor[0], t.anchor[2]], p.pos]);
  const out: DecorCase[] = [];
  const inset = 0.75;
  const tryAt = (x: number, z: number, yaw: number) => {
    const p: V2 = [x, z];
    if (keep.some((k) => Math.hypot(k[0] - x, k[1] - z) < 2.4)) return;
    if (segs.some(([a, b]) => segDist(p, a, b) < 1.4)) return;
    for (const pr of level.props) {
      if (pr.kind === 'solid' && x > pr.min[0] - 1 && x < pr.max[0] + 1 && z > pr.min[2] - 1 && z < pr.max[2] + 1) return;
      if (pr.kind === 'laserLoop' && x > pr.min[0] - 1.2 && x < pr.max[0] + 1.2 && z > pr.min[1] - 1.2 && z < pr.max[1] + 1.2) return;
      if ((pr.kind === 'model' || pr.kind === 'mannequin' || pr.kind === 'window') && Math.hypot((pr.kind === 'mannequin' ? pr.pos[0] : pr.pos[0]) - x, (pr.kind === 'mannequin' ? pr.pos[1] : pr.pos[2]) - z) < 1.6) return;
    }
    for (const pit of R.pits ?? []) if (x > pit.min[0] - 1 && x < pit.max[0] + 1 && z > pit.min[1] - 1 && z < pit.max[1] + 1) return;
    if (out.some((o) => Math.hypot(o.pos[0] - x, o.pos[1] - z) < 2.2)) return;
    const items: DecorCase['item'][] = ['vase', 'bust', 'gem'];
    out.push({ pos: p, yaw, item: items[(out.length + level.id) % 3] });
  };
  for (let x = R.x0 + 1.4; x <= R.x1 - 1.4; x += 2.4) {
    tryAt(x, R.z0 + inset, 0);
    tryAt(x, R.z1 - inset, Math.PI);
  }
  for (let z = R.z0 + 1.4; z <= R.z1 - 1.4; z += 2.4) {
    tryAt(R.x0 + inset, z, Math.PI / 2);
    tryAt(R.x1 - inset, z, -Math.PI / 2);
  }
  return out.slice(0, 6);
}
