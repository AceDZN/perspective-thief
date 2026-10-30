// Headless game simulation: movement, aiming, grab/drop, consequences, guard, stars.
// No Three.js. The scene reads this state and renders it; tests drive it directly.
import { LEVELS, type Exhibit, type Level, type Target, type V2, type V3 } from './levels.ts';
import { checkDrop, explain, starsFor, type ConsequenceKind, type DropCheck } from './rules.ts';
import { CASE_H, CASE_HALF, decorCases, type DecorCase } from './decor.ts';
import { aabbOverlap, localBounds, rampTop, rayAABB, rotateOrientation, worldAABB, type AABB } from './shapes.ts';

export const EYE = 1.6;
export const RADIUS = 0.28;
export const WALK = 3.2;
export const CREEP = 0.9;
export const STEP = 0.35;
export const CLIMB = 1.6;
export const GRAB_RANGE = 12;
export const AIM_RANGE = 16;
export const MIN_DROP = 0.6;
export const PAD_SNAP = 0.5;
export const GUARD_CHASE = 1.9;
export const GUARD_PATROL = 1.1;
export const HIDE_R = 1.0;
export const CATCH_R = 0.85;
export const VISION_R = 5.5;
export const VISION_HALF = (45 * Math.PI) / 180;

export interface Input {
  fwd: number;
  strafe: number;
  creep: boolean;
  /** Look delta in radians this step: [yaw, pitch]. */
  look: [number, number];
  act: boolean;
  rotate: boolean;
  climb: boolean;
}

export const NO_INPUT: Input = { fwd: 0, strafe: 0, creep: false, look: [0, 0], act: false, rotate: false, climb: false };

export type ExState = 'pedestal' | 'carried' | 'floor' | 'placed' | 'flying';

export interface ExRT {
  def: Exhibit;
  scale: number;
  orientation: number;
  state: ExState;
  pos: V3;
  yaw: number;
}

export interface Collider {
  box: AABB;
  ramp?: { ex: ExRT };
  exId?: string;
  walkable?: boolean;
}

export type Phase = 'play' | 'whoosh' | 'consequence' | 'chase' | 'hidden' | 'caught' | 'explain' | 'won';

export interface Aim {
  kind: 'none' | 'exhibit' | 'target' | 'floor';
  id?: string;
  point: V3;
  d: number;
  valid: boolean;
  reason?: string;
}

export type GuardMode = 'off' | 'chase' | 'search' | 'leave' | 'patrol' | 'grab';

export interface Guard {
  mode: GuardMode;
  pos: V2;
  yaw: number;
  t: number;
  patrolIdx: number;
  target: V2;
}

export interface Failure {
  kind: ConsequenceKind;
  exId: string;
  targetId?: string;
  check?: DropCheck;
  d1: number;
  d2: number;
  lines: string[];
  newScale: number;
  point: V3;
  yaw: number;
  alarm: boolean;
}

export interface Carry {
  exId: string;
  d1: number;
  /** Eye → exhibit-centre distance at grab, for the forced-perspective hold size. */
  grab3d: number;
  fromPad: boolean;
}

export interface Whoosh {
  exId: string;
  from: { scale: number };
  to: V3;
  yaw: number;
  newScale: number;
  t: number;
  dur: number;
  verdict: 'fit' | 'fail' | 'floor';
}

export type GameEvent =
  | { type: 'grab'; exId: string; d1: number; pad: boolean }
  | { type: 'drop'; exId: string; d2: number; k: number }
  | { type: 'fit'; exId: string; targetId: string; k: number }
  | { type: 'floor'; exId: string; k: number }
  | { type: 'fail'; kind: ConsequenceKind; exId: string; targetId?: string; k: number }
  | { type: 'alarm' }
  | { type: 'hide' }
  | { type: 'caught' }
  | { type: 'spotted' }
  | { type: 'guardGone' }
  | { type: 'climb' }
  | { type: 'fell' }
  | { type: 'rotate'; orientation: number }
  | { type: 'cantDrop'; reason: string }
  | { type: 'hint' }
  | { type: 'exitOpen' }
  | { type: 'won'; stars: number }
  | { type: 'step' };

export interface LearnEvent {
  level: number;
  action: 'grab' | 'drop' | 'hint' | 'regrab';
  exId?: string;
  targetId?: string;
  d1?: number;
  d2?: number;
  k?: number;
  kNeeded?: number;
  outcome?: string;
  hinted: boolean;
  attempt: number;
  firstUnaided?: boolean;
  t: number;
}

export interface Stats {
  hints: number;
  alarms: number;
  failures: number;
  regrabs: number;
  caught: number;
}

export class Sim {
  level: Level;
  time = 0;
  phase: Phase = 'play';
  phaseT = 0;
  player = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, vy: 0 };
  moved = false;
  exhibits: ExRT[] = [];
  solved = new Set<string>();
  colliders: Collider[] = [];
  carry: Carry | null = null;
  whoosh: Whoosh | null = null;
  failure: Failure | null = null;
  guard: Guard;
  aim: Aim = { kind: 'none', point: [0, 0, 0], d: 0, valid: false };
  stats: Stats = { hints: 0, alarms: 0, failures: 0, regrabs: 0, caught: 0 };
  hintShown = false;
  events: GameEvent[] = [];
  log: LearnEvent[] = [];
  stars = 0;
  hideIdx = -1;
  private pushT = 0;
  private stepDist = 0;
  private attempts = new Map<string, number>();
  decor: DecorCase[] = [];
  /** Every successful drop: how close k was to the exact ratio (1 = perfect). */
  fits: { targetId: string; k: number; kNeeded: number; accuracy: number; firstTry: boolean }[] = [];

  constructor(levelOrId: Level | number) {
    this.level = typeof levelOrId === 'number' ? LEVELS.find((l) => l.id === levelOrId)! : levelOrId;
    const L = this.level;
    this.player.x = L.spawn.pos[0];
    this.player.z = L.spawn.pos[1];
    this.player.yaw = L.spawn.yaw;
    this.guard = { mode: L.patrol ? 'patrol' : 'off', pos: L.patrol ? [...L.patrol[0]] as V2 : [...L.guardDoor] as V2, yaw: 0, t: 0, patrolIdx: 0, target: [0, 0] };
    for (const def of L.exhibits) {
      this.exhibits.push({
        def,
        scale: def.initialScale ?? 1,
        orientation: def.orientation ?? 0,
        state: 'pedestal',
        pos: [def.pos[0], def.pedestal, def.pos[1]],
        yaw: def.yaw,
      });
    }
    this.decor = decorCases(this.level);
    this.rebuildColliders();
  }

  // ─────────────── geometry ───────────────

  exBox(ex: ExRT, scale = ex.scale, pos = ex.pos, yaw = ex.yaw): AABB {
    return worldAABB(localBounds(ex.def.shape, scale, ex.orientation), pos, yaw);
  }

  rebuildColliders(): void {
    const L = this.level;
    const cs: Collider[] = [];
    for (const p of L.props) if (p.kind === 'solid') cs.push({ box: { min: p.min, max: p.max }, walkable: p.walkable });
    for (const p of L.props) if (p.kind === 'model' && p.collide) cs.push({ box: { min: [p.pos[0] - 0.4, p.pos[1], p.pos[2] - 0.4], max: [p.pos[0] + 0.4, p.pos[1] + p.h, p.pos[2] + 0.4] } });
    for (const d of this.decor) cs.push({ box: { min: [d.pos[0] - CASE_HALF, 0, d.pos[1] - CASE_HALF], max: [d.pos[0] + CASE_HALF, CASE_H, d.pos[1] + CASE_HALF] } });
    for (const p of L.props) if (p.kind === 'mannequin') cs.push({ box: { min: [p.pos[0] - 0.25, 0, p.pos[1] - 0.25], max: [p.pos[0] + 0.25, p.h, p.pos[1] + 0.25] } });
    for (const ex of this.exhibits) {
      const def = ex.def;
      if (def.pedestal > 0) {
        const b = worldAABB(localBounds(def.shape, def.initialScale ?? 1, def.orientation ?? 0), [def.pos[0], 0, def.pos[1]], def.yaw);
        const hw = Math.max(0.3, (b.max[0] - b.min[0]) / 2 + 0.12);
        const hd = Math.max(0.3, (b.max[2] - b.min[2]) / 2 + 0.12);
        cs.push({ box: { min: [def.pos[0] - hw, 0, def.pos[1] - hd], max: [def.pos[0] + hw, def.pedestal, def.pos[1] + hd] } });
      }
      if (ex.state === 'carried' || ex.state === 'flying') continue;
      if (def.shape.type === 'ramp') cs.push({ box: this.exBox(ex), ramp: { ex }, exId: def.id, walkable: true });
      else cs.push({ box: this.exBox(ex), exId: def.id, walkable: true });
    }
    this.colliders = cs;
  }

  /** Top of a collider at (x, z), or null if the point is outside it. */
  colliderTop(c: Collider, x: number, z: number, r = 0): number | null {
    const b = c.box;
    if (x < b.min[0] - r || x > b.max[0] + r || z < b.min[2] - r || z > b.max[2] + r) return null;
    if (c.ramp) {
      const ex = c.ramp.ex;
      if (ex.def.shape.type !== 'ramp') return null;
      return rampTop(ex.def.shape, ex.scale, ex.pos, ex.yaw, Math.min(Math.max(x, b.min[0] + 1e-6), b.max[0] - 1e-6), Math.min(Math.max(z, b.min[2] + 1e-6), b.max[2] - 1e-6));
    }
    return b.max[1];
  }

  inPit(x: number, z: number): boolean {
    for (const p of this.level.room.pits ?? []) if (x > p.min[0] && x < p.max[0] && z > p.min[1] && z < p.max[1]) return true;
    return false;
  }

  /** Supporting ground height under (x, z) for feet at `feet` (surfaces no higher than feet + step). */
  groundAt(x: number, z: number, feet: number): number {
    let g = this.inPit(x, z) ? -50 : 0;
    for (const c of this.colliders) {
      const top = this.colliderTop(c, x, z, c.ramp ? 0 : RADIUS * 0.5);
      if (top !== null && top <= feet + STEP + 1e-6 && top > g) g = top;
    }
    return g;
  }

  blocked(x: number, z: number, feet: number): boolean {
    const R = this.level.room;
    if (x < R.x0 + RADIUS || x > R.x1 - RADIUS || z < R.z0 + RADIUS || z > R.z1 - RADIUS) return true;
    for (const c of this.colliders) {
      const top = this.colliderTop(c, x, z, RADIUS);
      if (top === null) continue;
      if (c.ramp) {
        const here = this.colliderTop(c, x, z, 0);
        if (here !== null && here <= feet + STEP + 1e-6) continue;
        if (here === null) {
          // Beside the ramp: block only against its tall sides.
          if (top > feet + STEP && c.box.min[1] < feet + 1.7) {
            const inside = x > c.box.min[0] && x < c.box.max[0] && z > c.box.min[2] && z < c.box.max[2];
            if (inside) return true;
          }
          continue;
        }
        return true;
      }
      if (top > feet + STEP + 1e-6 && c.box.min[1] < feet + 1.7) return true;
    }
    return false;
  }

  eye(): V3 {
    return [this.player.x, this.player.y + EYE, this.player.z];
  }

  lookDir(): V3 {
    const { yaw, pitch } = this.player;
    return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  }

  hdist(a: V2 | V3, x = this.player.x, z = this.player.z): number {
    const ax = a[0], az = a.length === 3 ? (a as V3)[2] : (a as V2)[1];
    return Math.hypot(ax - x, az - z);
  }

  targetActive(t: Target): boolean {
    return !this.solved.has(t.id) && (!t.requires || this.solved.has(t.requires));
  }

  /** Recompute what the lens is pointing at. */
  updateAim(): void {
    const o = this.eye();
    const d = this.lookDir();
    const R = this.level.room;
    // Room interior: distance to the first wall/ceiling/floor along the ray.
    let tRoom = AIM_RANGE * 2;
    let roomN: V3 = [0, 0, 0];
    const bounds: [number, number][] = [[R.x0, R.x1], [-60, R.h], [R.z0, R.z1]];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) continue;
      const b = d[i] > 0 ? bounds[i][1] : bounds[i][0];
      const t = (b - o[i]) / d[i];
      if (t > 0 && t < tRoom) {
        tRoom = t;
        roomN = [0, 0, 0];
        roomN[i] = d[i] > 0 ? -1 : 1;
      }
    }
    let best = { t: tRoom, n: roomN, kind: 'room' as 'room' | 'collider' | 'floor' | 'exhibit', id: undefined as string | undefined };
    // Floor plane y = 0 (outside pits).
    if (d[1] < -1e-6) {
      const t = -o[1] / d[1];
      const px = o[0] + d[0] * t, pz = o[2] + d[2] * t;
      if (t < best.t && !this.inPit(px, pz)) best = { t, n: [0, 1, 0], kind: 'floor', id: undefined };
    }
    for (const c of this.colliders) {
      if (c.exId && !this.carry) continue; // exhibits are tested below for grabbing
      const h = rayAABB(o, d, c.box, best.t);
      if (h && h.t > 0.05 && h.t < best.t) best = { t: h.t, n: h.n, kind: 'collider', id: c.exId };
    }
    if (!this.carry) {
      let pick: { t: number; id: string } | null = null;
      for (const ex of this.exhibits) {
        if (ex.state !== 'pedestal' && ex.state !== 'floor') continue;
        const b = this.exBox(ex);
        const pad = 0.12;
        const grow = (lo: number, hi: number) => (hi - lo < 0.3 ? (0.3 - (hi - lo)) / 2 : 0) + pad;
        const g = [grow(b.min[0], b.max[0]), grow(b.min[1], b.max[1]), grow(b.min[2], b.max[2])];
        const box: AABB = { min: [b.min[0] - g[0], b.min[1] - g[1], b.min[2] - g[2]], max: [b.max[0] + g[0], b.max[1] + g[1], b.max[2] + g[2]] };
        const h = rayAABB(o, d, box, best.t + 0.3);
        if (h && (!pick || h.t < pick.t)) pick = { t: h.t, id: ex.def.id };
      }
      if (pick) {
        const ex = this.ex(pick.id)!;
        const dd = this.hdist(ex.pos);
        const valid = dd <= GRAB_RANGE;
        this.aim = { kind: 'exhibit', id: pick.id, point: [o[0] + d[0] * pick.t, o[1] + d[1] * pick.t, o[2] + d[2] * pick.t], d: dd, valid, reason: valid ? undefined : 'רחוק מדי' };
        return;
      }
      const p: V3 = [o[0] + d[0] * best.t, o[1] + d[1] * best.t, o[2] + d[2] * best.t];
      this.aim = { kind: 'none', point: p, d: this.hdist(p), valid: false };
      return;
    }
    // Carrying: targets first (their zones are generous on purpose).
    let tgt: { t: number; target: Target } | null = null;
    for (const t of this.level.targets) {
      if (!this.targetActive(t)) continue;
      const z = t.zone;
      const box: AABB = { min: [z.c[0] - z.h[0], z.c[1] - z.h[1], z.c[2] - z.h[2]], max: [z.c[0] + z.h[0], z.c[1] + z.h[1], z.c[2] + z.h[2]] };
      const h = rayAABB(o, d, box, AIM_RANGE * 2);
      if (h && (!tgt || h.t < tgt.t)) tgt = { t: h.t, target: t };
    }
    if (tgt) {
      const dd = this.hdist(tgt.target.anchor);
      const valid = dd >= MIN_DROP && dd <= AIM_RANGE;
      this.aim = { kind: 'target', id: tgt.target.id, point: [...tgt.target.anchor] as V3, d: dd, valid, reason: dd < MIN_DROP ? 'קרוב מדי' : dd > AIM_RANGE ? 'רחוק מדי' : undefined };
      return;
    }
    let p: V3 = [o[0] + d[0] * best.t, o[1] + d[1] * best.t, o[2] + d[2] * best.t];
    let valid = true;
    let reason: string | undefined;
    if (best.n[1] === 1) {
      // On a floor or a top surface: drop right here.
    } else if (best.n[1] === -1) {
      valid = false;
      reason = 'אי אפשר להניח על התקרה';
    } else {
      // A wall or a vertical face: drop at its foot, pulled back toward the player.
      const back = 0.35;
      const hx = p[0] - d[0] / Math.hypot(d[0], d[2]) * back;
      const hz = p[2] - d[2] / Math.hypot(d[0], d[2]) * back;
      const g = this.groundAt(hx, hz, p[1]);
      p = [hx, g, hz];
      if (g < -1) { valid = false; reason = 'זו תהום'; }
    }
    const dd = this.hdist(p);
    if (dd < MIN_DROP) { valid = false; reason = 'קרוב מדי'; }
    if (dd > AIM_RANGE) { valid = false; reason = 'רחוק מדי'; }
    this.aim = { kind: 'floor', point: p, d: dd, valid, reason };
  }

  ex(id: string): ExRT | undefined {
    return this.exhibits.find((e) => e.def.id === id);
  }

  target(id: string): Target | undefined {
    return this.level.targets.find((t) => t.id === id);
  }

  // ─────────────── actions ───────────────

  grab(): boolean {
    if (this.phase !== 'play' || this.carry) return false;
    this.updateAim();
    const a = this.aim;
    if (a.kind !== 'exhibit' || !a.valid || !a.id) return false;
    const ex = this.ex(a.id)!;
    let d1 = this.hdist(ex.pos);
    let fromPad = false;
    for (const pad of this.level.pads) {
      if (pad.forId === ex.def.id && ex.state === 'pedestal' && this.hdist(pad.pos) <= PAD_SNAP) {
        this.player.x = pad.pos[0];
        this.player.z = pad.pos[1];
        d1 = pad.d;
        fromPad = true;
      }
    }
    d1 = Math.max(0.3, d1);
    const b = this.exBox(ex);
    const c: V3 = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    const e = this.eye();
    const grab3d = Math.max(0.3, Math.hypot(c[0] - e[0], c[1] - e[1], c[2] - e[2]));
    if (ex.state === 'floor') {
      this.stats.regrabs++;
      this.learn({ action: 'regrab', exId: ex.def.id, d1 });
    }
    ex.state = 'carried';
    this.carry = { exId: ex.def.id, d1, grab3d, fromPad };
    this.rebuildColliders();
    this.events.push({ type: 'grab', exId: ex.def.id, d1, pad: fromPad });
    this.learn({ action: 'grab', exId: ex.def.id, d1 });
    return true;
  }

  rotate(): void {
    if (!this.carry) return;
    const ex = this.ex(this.carry.exId)!;
    if (ex.def.shape.type !== 'tri') return;
    ex.orientation = rotateOrientation(ex.orientation, 1);
    this.events.push({ type: 'rotate', orientation: ex.orientation });
  }

  drop(): boolean {
    if (this.phase !== 'play' || !this.carry) return false;
    this.updateAim();
    const a = this.aim;
    const carry = this.carry;
    const ex = this.ex(carry.exId)!;
    if (!a.valid || (a.kind !== 'target' && a.kind !== 'floor')) {
      this.events.push({ type: 'cantDrop', reason: a.reason ?? 'כוונו לרצפה או למטרה' });
      return false;
    }
    const d1 = carry.d1;
    const d2 = a.d;
    const k = d2 / d1;
    const newScale = ex.scale * k;
    const R = this.level.room;
    this.events.push({ type: 'drop', exId: ex.def.id, d2, k });
    this.carry = null;
    ex.state = 'flying';

    if (a.kind === 'target') {
      const t = this.target(a.id!)!;
      const attempt = (this.attempts.get(t.id) ?? 0) + 1;
      this.attempts.set(t.id, attempt);
      if (t.accepts !== ex.def.id) {
        // A piece that is not similar to this frame never fits, whatever k is.
        const lines = ex.def.similar === false
          ? [`השתמשתם ב־⟦k = ${round(d2)} ÷ ${round(d1)} = ${round(k)}⟧`, 'הצורה הזאת לא דומה למסגרת: הזוויות והצלעות שלה לא מתאימות, ולכן אין ⟦k⟧ שיתאים. שטח שווה לא אומר דמיון.']
          : ['זה לא החפץ שמתאים למטרה הזאת. נסו חפץ אחר.'];
        this.learn({ action: 'drop', exId: ex.def.id, targetId: t.id, d1, d2, k, outcome: ex.def.similar === false ? 'notSimilar' : 'wrongExhibit', attempt });
        return this.startFail({ kind: 'noFit', exId: ex.def.id, targetId: t.id, d1, d2, lines, newScale, point: [...t.anchor] as V3, yaw: t.yaw, alarm: false });
      }
      const measure = ex.def.measures[t.measure];
      const check = checkDrop({
        measure,
        need: t.need,
        currentScale: ex.scale,
        d1,
        d2,
        orientationOk: t.orientation === undefined || ex.orientation === t.orientation,
        similarShape: ex.def.similar !== false,
      });
      const top = t.anchor[1] + localBounds(ex.def.shape, newScale, ex.orientation).max[1];
      let kind: ConsequenceKind | null = null;
      if (top > R.h) kind = 'roofCrash';
      else if (check.verdict === 'tooBig') kind = t.tooBig;
      else if (check.verdict === 'tooSmall') kind = t.tooSmall;
      else if (check.verdict === 'jam') kind = 'jam';
      else if (check.verdict === 'noFit') kind = 'noFit';
      this.learn({ action: 'drop', exId: ex.def.id, targetId: t.id, d1, d2, k, kNeeded: check.kNeeded, outcome: kind ?? 'fit', attempt, firstUnaided: attempt === 1 && !this.hintShown });
      if (!kind) {
        this.fits.push({ targetId: t.id, k, kNeeded: check.kNeeded, accuracy: Math.max(0, 1 - Math.abs(k - check.kNeeded) / check.kNeeded), firstTry: attempt === 1 && !this.hintShown });
        this.whoosh = { exId: ex.def.id, from: { scale: ex.scale }, to: [...t.anchor] as V3, yaw: t.yaw, newScale, t: 0, dur: 0.45, verdict: 'fit' };
        this.setPhase('whoosh');
        return true;
      }
      const lines = explain(check, measure, d1, d2, attempt);
      if (kind === 'roofCrash' && check.verdict === 'fit') lines.unshift('גבוה מהתקרה!');
      return this.startFail({ kind, exId: ex.def.id, targetId: t.id, check, d1, d2, lines, newScale, point: [...t.anchor] as V3, yaw: t.yaw, alarm: kind === 'crash' || kind === 'roofCrash' });
    }

    // Floor drop.
    const pos: V3 = [...a.point] as V3;
    const yaw = ex.def.shape.type === 'ramp' || ex.def.shape.type === 'plank' ? ex.yaw : this.player.yaw + Math.PI;
    const box = this.exBox(ex, newScale, pos, yaw);
    let kind: ConsequenceKind | null = null;
    if (box.max[1] > R.h) kind = 'roofCrash';
    else if (box.min[0] < R.x0 - 0.01 || box.max[0] > R.x1 + 0.01 || box.min[2] < R.z0 - 0.01 || box.max[2] > R.z1 + 0.01) kind = 'crash';
    else {
      for (const c of this.colliders) {
        if (aabbOverlap(box, c.box, 0.02)) { kind = 'crash'; break; }
      }
    }
    this.learn({ action: 'drop', exId: ex.def.id, d1, d2, k, outcome: kind ?? 'floor', attempt: 0 });
    if (kind) {
      const lines = [`⟦k = ${round(d2)} ÷ ${round(d1)} = ${round(k)}⟧`, kind === 'roofCrash' ? 'גבוה מהתקרה — דרך הגג!' : 'גדול מדי למקום הזה — התנגש!'];
      return this.startFail({ kind, exId: ex.def.id, d1, d2, lines, newScale, point: pos, yaw, alarm: true });
    }
    // The lens's change only sticks on a target: anywhere else the exhibit flies back to its
    // pedestal at its starting size (no sizing things up by eye on the floor).
    this.whoosh = { exId: ex.def.id, from: { scale: ex.scale }, to: [ex.def.pos[0], ex.def.pedestal, ex.def.pos[1]], yaw: ex.def.yaw, newScale: ex.def.initialScale ?? 1, t: 0, dur: 0.6, verdict: 'floor' };
    this.setPhase('whoosh');
    return true;
  }

  private startFail(f: Failure): boolean {
    const ex = this.ex(f.exId)!;
    this.failure = f;
    this.stats.failures++;
    this.whoosh = { exId: f.exId, from: { scale: ex.scale }, to: f.point, yaw: f.yaw, newScale: f.newScale, t: 0, dur: 0.45, verdict: 'fail' };
    this.setPhase('whoosh');
    return false;
  }

  useHint(): boolean {
    if (this.level.noHints || this.level.hint.length === 0) return false;
    if (!this.hintShown) this.stats.hints++;
    this.hintShown = true;
    this.events.push({ type: 'hint' });
    this.learn({ action: 'hint' });
    return true;
  }

  dismiss(): void {
    if (this.phase === 'explain') {
      this.failure = null;
      this.setPhase('play');
    }
  }

  private learn(e: Partial<LearnEvent> & { action: LearnEvent['action'] }): void {
    this.log.push({ level: this.level.id, hinted: this.hintShown, attempt: 0, t: Math.round(this.time * 10) / 10, ...e });
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  allSolved(): boolean {
    return this.level.targets.every((t) => this.solved.has(t.id));
  }

  // ─────────────── step ───────────────

  step(dt: number, input: Input = NO_INPUT): void {
    this.time += dt;
    this.phaseT += dt;
    const P = this.player;
    // Look is always allowed (except while hidden/caught, where the camera is scripted).
    if (this.phase !== 'caught') {
      P.yaw += input.look[0];
      P.pitch = Math.max(-1.35, Math.min(1.35, P.pitch + input.look[1]));
    }
    this.moved = false;
    const canMove = this.phase === 'play' || this.phase === 'chase' || this.phase === 'whoosh';
    if (canMove) this.move(dt, input);
    else this.gravity(dt);

    if (this.phase === 'play' && input.act) {
      if (this.carry) this.drop();
      else this.grab();
    } else if (this.phase === 'explain' && input.act) {
      this.dismiss();
    }
    if (input.rotate) this.rotate();

    switch (this.phase) {
      case 'whoosh':
        this.stepWhoosh(dt);
        break;
      case 'consequence':
        if (this.phaseT >= 1.6) this.endConsequence();
        break;
      case 'chase':
      case 'hidden':
      case 'caught':
        this.stepGuardChase(dt);
        break;
      default:
        break;
    }
    if (this.level.patrol && (this.phase === 'play' || this.phase === 'whoosh')) this.stepPatrol(dt);

    if (this.phase === 'play' && this.allSolved()) {
      const e = this.level.exit;
      if (this.hdist(e.pos) <= e.r && Math.abs(P.y - e.pos[1]) < 0.7) {
        this.stars = starsFor(this.stats);
        this.setPhase('won');
        this.events.push({ type: 'won', stars: this.stars });
      }
    }
    this.updateAim();
  }

  private gravity(dt: number): void {
    const P = this.player;
    const g = this.groundAt(P.x, P.z, P.y);
    if (P.y > g + 1e-4) {
      P.vy -= 18 * dt;
      P.y = Math.max(g, P.y + P.vy * dt);
      if (P.y === g) P.vy = 0;
    } else {
      P.y = g;
      P.vy = 0;
    }
    if (P.y < -3) {
      this.events.push({ type: 'fell' });
      this.respawnPlayer();
    }
  }

  respawnPlayer(): void {
    const L = this.level;
    this.player.x = L.spawn.pos[0];
    this.player.z = L.spawn.pos[1];
    this.player.y = 0;
    this.player.vy = 0;
    this.player.yaw = L.spawn.yaw;
    this.player.pitch = 0;
  }

  private move(dt: number, input: Input): void {
    const P = this.player;
    let f = input.fwd, s = input.strafe;
    const m = Math.hypot(f, s);
    if (m > 1) { f /= m; s /= m; }
    const speed = (input.creep ? CREEP : WALK) * (this.carry ? 0.9 : 1);
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    const rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const dx = (fx * f + rx * s) * speed * dt;
    const dz = (fz * f + rz * s) * speed * dt;
    const onGround = Math.abs(P.y - this.groundAt(P.x, P.z, P.y)) < 1e-3;
    let pushed = false;
    if (dx !== 0 || dz !== 0) {
      this.moved = true;
      const ox = P.x, oz = P.z;
      if (!this.blocked(P.x + dx, P.z, P.y)) P.x += dx;
      else pushed = true;
      if (!this.blocked(P.x, P.z + dz, P.y)) P.z += dz;
      else pushed = true;
      const moved = Math.hypot(P.x - ox, P.z - oz);
      this.stepDist += moved;
      if (this.stepDist > 0.75 && onGround) {
        this.stepDist = 0;
        this.events.push({ type: 'step' });
      }
    }
    // Step up onto low surfaces.
    const g = this.groundAt(P.x, P.z, P.y);
    if (g > P.y) P.y = g;
    this.gravity(dt);
    // Climb: Space, or keep pushing forward into a ledge.
    if (pushed && f > 0.3) this.pushT += dt;
    else this.pushT = 0;
    if ((input.climb || this.pushT > 0.35) && onGround) this.tryClimb();
  }

  /** Is there a ledge you could climb right in front of you? (for the touch climb button) */
  climbable(): boolean {
    const P = this.player;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    for (const reach of [0.45, 0.6, 0.8]) {
      const x = P.x + fx * reach, z = P.z + fz * reach;
      let top = -Infinity;
      for (const c of this.colliders) {
        const t = this.colliderTop(c, x, z, 0);
        if (t !== null && t > top) top = t;
      }
      if (top > P.y + STEP && top <= P.y + CLIMB + 1e-6 && top + 1.75 <= this.level.room.h && !this.blocked(x, z, top)) return true;
    }
    return false;
  }

  tryClimb(): boolean {
    const P = this.player;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    for (const reach of [0.45, 0.6, 0.8]) {
      const x = P.x + fx * reach, z = P.z + fz * reach;
      let top = -Infinity;
      for (const c of this.colliders) {
        const t = this.colliderTop(c, x, z, 0);
        if (t !== null && t > top) top = t;
      }
      if (top > P.y + STEP && top <= P.y + CLIMB + 1e-6) {
        // Room above?
        if (top + 1.75 > this.level.room.h) continue;
        if (this.blocked(x, z, top)) continue;
        P.x = x;
        P.z = z;
        P.y = top;
        P.vy = 0;
        this.pushT = 0;
        this.events.push({ type: 'climb' });
        return true;
      }
    }
    return false;
  }

  private stepWhoosh(dt: number): void {
    const w = this.whoosh!;
    w.t += dt;
    if (w.t < w.dur) return;
    const ex = this.ex(w.exId)!;
    if (w.verdict === 'fail') {
      ex.pos = w.to;
      ex.yaw = w.yaw;
      ex.scale = w.newScale;
      this.whoosh = null;
      const f = this.failure!;
      this.events.push({ type: 'fail', kind: f.kind, exId: f.exId, targetId: f.targetId, k: f.d2 / f.d1 });
      this.setPhase('consequence');
      return;
    }
    ex.pos = w.to;
    ex.yaw = w.yaw;
    ex.scale = w.newScale;
    this.whoosh = null;
    if (w.verdict === 'fit') {
      const t = this.level.targets.find((t) => t.accepts === ex.def.id && this.targetActive(t))!;
      ex.state = 'placed';
      this.solved.add(t.id);
      this.events.push({ type: 'fit', exId: ex.def.id, targetId: t.id, k: w.newScale });
      if (this.allSolved()) this.events.push({ type: 'exitOpen' });
    } else {
      ex.state = 'pedestal';
      ex.orientation = ex.def.orientation ?? 0;
      this.events.push({ type: 'floor', exId: ex.def.id, k: w.newScale });
    }
    this.rebuildColliders();
    this.setPhase('play');
  }

  private endConsequence(): void {
    const f = this.failure!;
    // The exhibit respawns on its pedestal at its level-start size.
    const ex = this.ex(f.exId)!;
    ex.scale = ex.def.initialScale ?? 1;
    ex.orientation = ex.def.orientation ?? 0;
    ex.pos = [ex.def.pos[0], ex.def.pedestal, ex.def.pos[1]];
    ex.yaw = ex.def.yaw;
    ex.state = 'pedestal';
    this.rebuildColliders();
    if (f.alarm) {
      this.stats.alarms++;
      this.events.push({ type: 'alarm' });
      this.startChase(true);
    } else {
      this.setPhase('explain');
    }
  }

  private startChase(fromDoor: boolean): void {
    const G = this.guard;
    if (fromDoor || G.mode === 'off') G.pos = [...this.level.guardDoor] as V2;
    G.mode = 'chase';
    G.t = 0;
    this.setPhase('chase');
  }

  private moveGuard(to: V2, speed: number, dt: number): boolean {
    const G = this.guard;
    const dx = to[0] - G.pos[0], dz = to[1] - G.pos[1];
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-3) return true;
    G.yaw = Math.atan2(-dx, -dz);
    const s = Math.min(dist, speed * dt);
    G.pos = [G.pos[0] + (dx / dist) * s, G.pos[1] + (dz / dist) * s];
    return dist <= speed * dt + 1e-6;
  }

  private stepGuardChase(dt: number): void {
    const G = this.guard;
    G.t += dt;
    const P = this.player;
    if (this.phase === 'chase') {
      // Hide?
      this.level.hides.forEach((h, i) => {
        if (this.phase === 'chase' && this.hdist(h) <= HIDE_R) {
          this.hideIdx = i;
          this.setPhase('hidden');
          G.mode = 'search';
          G.t = 0;
          // The guard searches a couple of metres out from the sarcophagus, toward the room centre.
          const R = this.level.room;
          const cx = (R.x0 + R.x1) / 2 - h[0], cz = (R.z0 + R.z1) / 2 - h[1];
          const cl = Math.hypot(cx, cz) || 1;
          G.target = [h[0] + (cx / cl) * 2.3, h[1] + (cz / cl) * 2.3];
          this.events.push({ type: 'hide' });
        }
      });
      if (this.phase === 'chase') {
        this.moveGuard([P.x, P.z], GUARD_CHASE, dt);
        if (this.hdist(G.pos) <= CATCH_R) {
          G.mode = 'grab';
          this.stats.caught++;
          this.events.push({ type: 'caught' });
          this.setPhase('caught');
        }
      }
      return;
    }
    if (this.phase === 'hidden') {
      if (G.mode === 'search') {
        const arrived = this.moveGuard(G.target, GUARD_CHASE * 0.8, dt);
        if (arrived && G.t > 1) {
          // Look around, scratch head, then leave.
          if (G.t > 2.8) { G.mode = 'leave'; G.t = 0; }
        }
      } else if (G.mode === 'leave') {
        const home = this.level.patrol ? this.level.patrol[G.patrolIdx] : this.level.guardDoor;
        const arrived = this.moveGuard(home, GUARD_CHASE, dt);
        if (arrived || G.t > 2.5) this.endChase();
      }
      return;
    }
    if (this.phase === 'caught') {
      if (this.phaseT > 2.6) {
        this.respawnPlayer();
        this.endChase();
      }
    }
  }

  private endChase(): void {
    const G = this.guard;
    if (this.level.patrol) {
      G.mode = 'patrol';
    } else {
      G.mode = 'off';
      G.pos = [...this.level.guardDoor] as V2;
    }
    if (this.hideIdx >= 0) {
      const h = this.level.hides[this.hideIdx];
      this.player.x = h[0];
      this.player.z = h[1] + 1.1 <= this.level.room.z1 - RADIUS ? h[1] + 1.1 : h[1] - 1.1;
      this.hideIdx = -1;
    }
    this.events.push({ type: 'guardGone' });
    this.setPhase(this.failure ? 'explain' : 'play');
  }

  private stepPatrol(dt: number): void {
    const G = this.guard;
    const route = this.level.patrol!;
    if (G.mode !== 'patrol') return;
    // Time moves for the guard only while you move (stand still to think), but he still sees
    // whatever is in his flashlight cone.
    if (this.moved) {
      const tgt = route[G.patrolIdx];
      if (this.moveGuard(tgt, GUARD_PATROL, dt)) G.patrolIdx = (G.patrolIdx + 1) % route.length;
    }
    // Vision cone.
    const dx = this.player.x - G.pos[0], dz = this.player.z - G.pos[1];
    const dist = Math.hypot(dx, dz);
    if (dist < VISION_R) {
      const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw);
      const cos = (dx * fx + dz * fz) / Math.max(dist, 1e-6);
      if (cos > Math.cos(VISION_HALF) || dist < 1.4) {
        if (this.carry) {
          // Dropping the loot as you flee: it returns to its pedestal.
          const ex = this.ex(this.carry.exId)!;
          ex.state = 'pedestal';
          this.carry = null;
          this.rebuildColliders();
        }
        this.events.push({ type: 'spotted' });
        this.stats.alarms++;
        this.startChase(false);
      }
    }
  }

  // ─────────────── reporting ───────────────

  toText(): string {
    const P = this.player;
    const r = (n: number) => Math.round(n * 100) / 100;
    const carry = this.carry ? { exhibit: this.carry.exId, d1: r(this.carry.d1), fromPad: this.carry.fromPad } : null;
    return JSON.stringify({
      coords: 'metres; x east, z south, y up; yaw 0 looks north (-z); d = horizontal floor distance',
      level: { id: this.level.id, title: this.level.title, world: this.level.world, objective: this.level.objective },
      phase: this.phase,
      player: { x: r(P.x), y: r(P.y), z: r(P.z), yaw: r(P.yaw), pitch: r(P.pitch) },
      carry,
      aim: { kind: this.aim.kind, id: this.aim.id, d: r(this.aim.d), valid: this.aim.valid, reason: this.aim.reason },
      exhibits: this.exhibits.map((e) => ({ id: e.def.id, state: e.state, scale: r(e.scale), orientation: e.orientation, pos: e.pos.map(r), placard: e.def.placard.join(' · ').replace(/[⟦⟧]/g, '') })),
      targets: this.level.targets.map((t) => ({ id: t.id, accepts: t.accepts, solved: this.solved.has(t.id), active: this.targetActive(t), anchor: t.anchor, plate: t.plate.join(' · ').replace(/[⟦⟧]/g, '') })),
      pads: this.level.pads.map((p) => ({ for: p.forId, pos: p.pos, d: p.d })),
      guard: { mode: this.guard.mode, pos: this.guard.pos.map(r) },
      hides: this.level.hides,
      failure: this.failure ? { kind: this.failure.kind, k: r(this.failure.d2 / this.failure.d1), kNeeded: this.failure.check ? r(this.failure.check.kNeeded) : null, explanation: this.failure.lines.map((l) => l.replace(/[⟦⟧]/g, '')) } : null,
      exitOpen: this.allSolved(),
      exit: this.level.exit,
      stats: this.stats,
      stars: this.stars,
    });
  }
}

function round(n: number): string {
  return String(Math.round(n * 100) / 100);
}
