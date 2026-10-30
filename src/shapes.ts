// Pure geometry of exhibit shapes: local bounds, triangle orientation, world AABBs.
import type { Shape, V2, V3 } from './levels.ts';

export interface AABB {
  min: V3;
  max: V3;
}

/**
 * Triangle with side `base` on the bottom, centred on the origin, apex above. Sides are listed
 * a, b, c; the vertex order is kept (no reflection), so a frame built the same way matches.
 * Returns three 2D points (x, y).
 */
export function trianglePoints(sides: [number, number, number], base: number): V2[] {
  // Rotate the side list so `base` comes first, keeping cyclic order (a rotation, not a flip).
  const s0 = sides[base % 3];
  const s1 = sides[(base + 1) % 3];
  const s2 = sides[(base + 2) % 3];
  // Base from P0 = (-s0/2, 0) to P1 = (s0/2, 0). Side s1 runs from P1 to apex, s2 from apex to P0.
  const x = (s0 * s0 + s2 * s2 - s1 * s1) / (2 * s0); // distance of apex from P0 along the base
  const y = Math.sqrt(Math.max(0, s2 * s2 - x * x));
  return [
    [-s0 / 2, 0],
    [s0 / 2, 0],
    [-s0 / 2 + x, y],
  ];
}

/** Which side index (0, 1, 2) is on the base after `turns` rotate presses from `start`. */
export function rotateOrientation(start: number, turns: number): number {
  return (((start + turns) % 3) + 3) % 3;
}

export function polyBounds(pts: V2[]): { x0: number; x1: number; y0: number; y1: number } {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0, x1, y0, y1 };
}

/** Local-space bounds at a given scale (origin conventions documented in levels.ts / README). */
export function localBounds(shape: Shape, scale: number, orientation = 0): AABB {
  const s = scale;
  switch (shape.type) {
    case 'box':
    case 'model':
      return { min: [(-shape.w / 2) * s, 0, (-shape.d / 2) * s], max: [(shape.w / 2) * s, shape.h * s, (shape.d / 2) * s] };
    case 'plank':
      return { min: [(-shape.w / 2) * s, 0, (-shape.l / 2) * s], max: [(shape.w / 2) * s, shape.t * s, (shape.l / 2) * s] };
    case 'ladder':
      return { min: [(-shape.w / 2) * s, 0, 0], max: [(shape.w / 2) * s, shape.h * s, shape.d * s] };
    case 'mirror':
      return { min: [(-shape.w / 2) * s, 0, 0], max: [(shape.w / 2) * s, shape.h * s, shape.t * s] };
    case 'tri': {
      const b = polyBounds(trianglePoints(shape.sides, orientation));
      return { min: [b.x0 * s, 0, 0], max: [b.x1 * s, b.y1 * s, shape.t * s] };
    }
    case 'ramp':
      return { min: [(-shape.w / 2) * s, 0, 0], max: [(shape.w / 2) * s, shape.rise * s, shape.run * s] };
    case 'pole':
      return { min: [-shape.r * s, 0, -shape.r * s], max: [shape.r * s, shape.h * s, shape.r * s] };
    case 'painting':
      return { min: [(-shape.w / 2) * s, 0, 0], max: [(shape.w / 2) * s, shape.h * s, shape.t * s] };
    case 'rug':
      return { min: [(-shape.w / 2) * s, 0, (-shape.d / 2) * s], max: [(shape.w / 2) * s, 0.02 * s, (shape.d / 2) * s] };
    case 'poly': {
      const b = polyBounds(shape.pts);
      return { min: [b.x0 * s, 0, 0], max: [b.x1 * s, b.y1 * s, shape.t * s] };
    }
    case 'key':
      return { min: [(-shape.l / 2) * s, 0, 0], max: [(shape.l / 2) * s, shape.l * 0.42 * s, shape.l * 0.08 * s] };
    case 'banner':
      return { min: [(-shape.w / 2) * s, 0, 0], max: [(shape.w / 2) * s, shape.h * s, 0.02 * s] };
  }
}

/** Rotate a local point by yaw (local +z → world (sin yaw, cos yaw)). */
export function rotY(x: number, z: number, yaw: number): V2 {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}

export function worldAABB(local: AABB, origin: V3, yaw: number): AABB {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const lx of [local.min[0], local.max[0]]) {
    for (const lz of [local.min[2], local.max[2]]) {
      const [wx, wz] = rotY(lx, lz, yaw);
      x0 = Math.min(x0, wx); x1 = Math.max(x1, wx);
      z0 = Math.min(z0, wz); z1 = Math.max(z1, wz);
    }
  }
  return {
    min: [origin[0] + x0, origin[1] + local.min[1], origin[2] + z0],
    max: [origin[0] + x1, origin[1] + local.max[1], origin[2] + z1],
  };
}

export function aabbOverlap(a: AABB, b: AABB, pad = 0): boolean {
  return (
    a.min[0] < b.max[0] - pad && a.max[0] > b.min[0] + pad &&
    a.min[1] < b.max[1] - pad && a.max[1] > b.min[1] + pad &&
    a.min[2] < b.max[2] - pad && a.max[2] > b.min[2] + pad
  );
}

/** Ray vs AABB (slab method). Returns entry distance and the hit face normal, or null. */
export function rayAABB(o: V3, d: V3, box: AABB, maxT = Infinity): { t: number; n: V3 } | null {
  let tmin = 0, tmax = maxT;
  let n: V3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-12) {
      if (o[i] < box.min[i] || o[i] > box.max[i]) return null;
      continue;
    }
    let t1 = (box.min[i] - o[i]) / d[i];
    let t2 = (box.max[i] - o[i]) / d[i];
    let sign = -1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; sign = 1; }
    if (t1 > tmin) {
      tmin = t1;
      n = [0, 0, 0];
      n[i] = sign;
    }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return { t: tmin, n };
}

/** Height of the walkable top of a ramp at a world point, given its origin/yaw/scale (or null if outside). */
export function rampTop(shape: Extract<Shape, { type: 'ramp' }>, scale: number, origin: V3, yaw: number, x: number, z: number): number | null {
  // Back to local.
  const [lx, lz] = rotY(x - origin[0], z - origin[2], -yaw);
  const run = shape.run * scale, rise = shape.rise * scale, w = shape.w * scale;
  if (Math.abs(lx) > w / 2 || lz < 0 || lz > run) return null;
  return origin[1] + rise * (1 - lz / run);
}

/** Are two polygons similar (same angles, proportional sides) up to rotation? Used for the glass level. */
export function similarPolygons(a: V2[], b: V2[], tol = 1e-6): boolean {
  if (a.length !== b.length) return false;
  const sides = (p: V2[]) => p.map((q, i) => Math.hypot(p[(i + 1) % p.length][0] - q[0], p[(i + 1) % p.length][1] - q[1]));
  const sa = sides(a), sb = sides(b);
  const n = a.length;
  for (let shift = 0; shift < n; shift++) {
    const k = sb[shift] / sa[0];
    let ok = true;
    for (let i = 0; i < n && ok; i++) if (Math.abs(sb[(i + shift) % n] - k * sa[i]) > tol * Math.max(1, k)) ok = false;
    if (ok) return true;
  }
  return false;
}
