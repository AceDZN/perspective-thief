// Builds a level's 3D room from level data. Everything that carries a number is procedural and
// exact; Tripo models are decoration, characters and personality props.
import * as THREE from 'three';
import type { Exhibit, Level, Prop, Shape, Target, V2, V3 } from './levels.ts';
import { kWindow } from './rules.ts';
import { localBounds, trianglePoints } from './shapes.ts';
import { CASE_H, CASE_HALF, decorCases } from './decor.ts';
import { Character, modelInBox, modelInstance } from './models.ts';
import {
  bannerTexture,
  crateTexture,
  floorTexture,
  glassTexture,
  glowSprite,
  labelTexture,
  marbleTexture,
  padTexture,
  paintingTexture,
  rugTexture,
  rulerTexture,
  skyTexture,
  stoneBlockTexture,
  panelTexture,
  facadeTexture,
  numberTexture,
  shaftTexture,
  velvetTexture,
  wallTexture,
  woodTexture,
} from './textures.ts';

const mats = new Map<string, THREE.Material>();
function mat(key: string, make: () => THREE.Material): THREE.Material {
  if (!mats.has(key)) mats.set(key, make());
  return mats.get(key)!;
}

export const M = {
  brass: () => mat('brass', () => new THREE.MeshStandardMaterial({ color: '#d4a94e', roughness: 0.28, metalness: 0.92 })),
  darkBrass: () => mat('darkBrass', () => new THREE.MeshStandardMaterial({ color: '#7a5a22', roughness: 0.4, metalness: 0.85 })),
  gold: () => mat('gold', () => new THREE.MeshStandardMaterial({ color: '#ffcf5a', roughness: 0.18, metalness: 1, emissive: '#5a3a00', emissiveIntensity: 0.4 })),
  marble: () => mat('marble', () => new THREE.MeshStandardMaterial({ map: marbleTexture('white'), color: '#a9acb8', roughness: 0.3, metalness: 0.05 })),
  stone: () => mat('stone', () => new THREE.MeshStandardMaterial({ map: marbleTexture('grey'), color: '#8a8c98', roughness: 0.7 })),
  wood: () => mat('wood', () => new THREE.MeshStandardMaterial({ map: woodTexture(true), roughness: 0.55 })),
  lightWood: () => mat('lightWood', () => new THREE.MeshStandardMaterial({ map: woodTexture(false), roughness: 0.65 })),
  crate: () => mat('crate', () => new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.8 })),
  velvet: () => mat('velvet', () => new THREE.MeshStandardMaterial({ map: velvetTexture(), roughness: 0.95 })),
  steel: () => mat('steel', () => new THREE.MeshStandardMaterial({ color: '#7f9aa0', roughness: 0.35, metalness: 0.9 })),
  dark: () => mat('dark', () => new THREE.MeshStandardMaterial({ color: '#0b0b10', roughness: 0.9 })),
  void: () => mat('void', () => new THREE.MeshBasicMaterial({ color: '#020205' })),
  laser: () => mat('laser', () => new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })),
  glass: () => mat('glass', () => new THREE.MeshStandardMaterial({ color: '#bfe3ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false })),
};

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, shadow = true): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = shadow;
  o.receiveShadow = true;
  return o;
}

export function boxAt(min: V3, max: V3, m: THREE.Material): THREE.Mesh {
  const o = mesh(new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]), m);
  o.position.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  return o;
}

/** A flat label plane of the given width; faces local +z. */
export function labelPlane(lines: string[], width: number, style: 'brass' | 'paper' | 'dark' = 'brass'): THREE.Mesh {
  const { texture, aspect } = labelTexture(lines, style);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / aspect),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75, metalness: style === 'brass' ? 0.25 : 0, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: 0.18 }),
  );
  m.receiveShadow = true;
  return m;
}

// ─────────────── exhibits ───────────────

function shapeFromPts(pts: V2[]): THREE.Shape {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

function extrude(pts: V2[], depth: number, m: THREE.Material | THREE.Material[]): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(shapeFromPts(pts), { depth, bevelEnabled: false });
  return mesh(geo, m as THREE.Material);
}

/** Exhibit mesh in its local frame at scale 1 (matches shapes.localBounds). */
export function buildExhibitMesh(def: Exhibit | { shape: Shape }, orientation = 0): THREE.Group {
  const g = new THREE.Group();
  const s = def.shape;
  switch (s.type) {
    case 'box': {
      const m = s.look === 'crate' ? M.crate() : s.look === 'gold' ? M.gold() : s.look === 'planter' ? M.lightWood() : s.look === 'tower' ? M.stone() : M.marble();
      const b = mesh(new THREE.BoxGeometry(s.w, s.h, s.d), m);
      b.position.y = s.h / 2;
      g.add(b);
      if (s.look === 'plinth') {
        const t = mesh(new THREE.BoxGeometry(s.w * 1.04, s.h * 0.08, s.d * 1.04), M.brass());
        t.position.y = s.h * 0.96;
        g.add(t);
      }
      if (s.look === 'planter') {
        const leaf = mat('leaf', () => new THREE.MeshStandardMaterial({ color: '#2f6b36', roughness: 0.9 }));
        for (let i = 0; i < 5; i++) {
          const bush = mesh(new THREE.SphereGeometry(s.w * 0.22, 12, 8), leaf);
          bush.position.set((i % 3 - 1) * s.w * 0.25, s.h + s.w * 0.08, (Math.floor(i / 3) - 0.5) * s.d * 0.3);
          g.add(bush);
        }
      }
      break;
    }
    case 'model': {
      const mdl = modelInBox(s.model, s.w, s.h, s.d);
      g.add(mdl);
      break;
    }
    case 'plank': {
      const b = mesh(new THREE.BoxGeometry(s.w, s.t, s.l), M.lightWood());
      b.position.y = s.t / 2;
      g.add(b);
      break;
    }
    case 'ladder': {
      const rail = s.w * 0.08;
      for (const x of [-s.w / 2 + rail / 2, s.w / 2 - rail / 2]) {
        for (const z of [rail / 2, s.d - rail / 2]) {
          const r = mesh(new THREE.BoxGeometry(rail, s.h, rail), M.lightWood());
          r.position.set(x, s.h / 2, z);
          g.add(r);
        }
      }
      const n = 6;
      for (let i = 1; i <= n; i++) {
        const y = (s.h * i) / (n + 0.4);
        for (const z of [rail / 2, s.d - rail / 2]) {
          const rung = mesh(new THREE.BoxGeometry(s.w, rail * 0.8, rail * 1.4), M.lightWood());
          rung.position.set(0, y, z);
          g.add(rung);
        }
      }
      const top = mesh(new THREE.BoxGeometry(s.w, rail, s.d), M.lightWood());
      top.position.y = s.h - rail / 2;
      g.add(top);
      break;
    }
    case 'mirror': {
      const frame = mesh(new THREE.BoxGeometry(s.w, s.h, s.t * 0.6), M.brass());
      frame.position.set(0, s.h / 2, s.t * 0.3);
      g.add(frame);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 0.84, s.h * 0.9), mat('mirror', () => new THREE.MeshStandardMaterial({ color: '#cfe2ff', roughness: 0.12, metalness: 0.85, emissive: '#3a5a8a', emissiveIntensity: 0.6, envMapIntensity: 2 })));
      glass.position.set(0, s.h / 2, s.t * 0.61);
      g.add(glass);
      const gem = mesh(new THREE.SphereGeometry(s.w * 0.12, 12, 8), mat('ruby', () => new THREE.MeshStandardMaterial({ color: '#ff3355', emissive: '#ff1133', emissiveIntensity: 0.8, roughness: 0.1 })));
      gem.position.set(0, s.h - s.w * 0.1, s.t * 0.75);
      g.add(gem);
      break;
    }
    case 'tri': {
      const pts = trianglePoints(s.sides, orientation);
      const body = extrude(pts, s.t, mat('sign', () => new THREE.MeshStandardMaterial({ color: '#2b5aa8', roughness: 0.5, metalness: 0.2 })));
      g.add(body);
      // Edge labels on the front face.
      for (let i = 0; i < 3; i++) {
        const a = pts[i], b = pts[(i + 1) % 3];
        const sideIndex = (orientation + i) % 3;
        const lw = Math.min(0.2, s.sides[sideIndex] * 0.42);
        const lbl = new THREE.Mesh(new THREE.PlaneGeometry(lw, lw * 0.55), new THREE.MeshStandardMaterial({ map: numberTexture(s.labels[sideIndex]), roughness: 0.6, emissive: '#ffffff', emissiveMap: numberTexture(s.labels[sideIndex]), emissiveIntensity: 0.25 }));
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        // Pull the label toward the centroid so it sits on the sign.
        const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
        lbl.position.set(mx + (cx - mx) * 0.32, my + (cy - my) * 0.32, s.t + 0.002);
        lbl.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
        if (Math.abs(lbl.rotation.z) > Math.PI / 2) lbl.rotation.z += Math.PI;
        g.add(lbl);
      }
      break;
    }
    case 'ramp': {
      const geo = new THREE.BufferGeometry();
      const w = s.w / 2, R = s.rise, L = s.run;
      // Vertices: back-bottom, back-top, front-bottom, for both sides.
      const v = [
        [-w, 0, 0], [-w, R, 0], [-w, 0, L],
        [w, 0, 0], [w, R, 0], [w, 0, L],
      ];
      const tris = [0, 2, 1, 3, 4, 5, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2];
      const pos: number[] = [];
      for (const i of tris) pos.push(...v[i]);
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      const uv: number[] = [];
      for (let i = 0; i < tris.length; i++) uv.push(pos[i * 3 + 2] / Math.max(L, 1e-6), pos[i * 3 + 1] / Math.max(R, 1e-6) + pos[i * 3] / (2 * w));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.add(mesh(geo, M.lightWood()));
      break;
    }
    case 'pole': {
      const p = mesh(new THREE.CylinderGeometry(s.r, s.r, s.h, 16), M.brass());
      p.position.y = s.h / 2;
      g.add(p);
      for (let i = 1; i < 6; i++) {
        const ring = mesh(new THREE.TorusGeometry(s.r * 1.15, s.r * 0.2, 6, 16), M.darkBrass());
        ring.rotation.x = Math.PI / 2;
        ring.position.y = (s.h * i) / 6;
        g.add(ring);
      }
      break;
    }
    case 'painting': {
      const fw = Math.min(s.w, s.h) * 0.1;
      const frame = mesh(new THREE.BoxGeometry(s.w, s.h, s.t), M.gold());
      frame.position.set(0, s.h / 2, s.t / 2);
      g.add(frame);
      const canvasM = new THREE.Mesh(new THREE.PlaneGeometry(s.w - 2 * fw, s.h - 2 * fw), new THREE.MeshStandardMaterial({ map: paintingTexture('cat'), roughness: 0.6 }));
      canvasM.position.set(0, s.h / 2, s.t + 0.001);
      g.add(canvasM);
      break;
    }
    case 'rug': {
      const r = mesh(new THREE.BoxGeometry(s.w, 0.02, s.d), new THREE.MeshStandardMaterial({ map: rugTexture(s.look), roughness: 0.95 }));
      r.position.y = 0.01;
      g.add(r);
      break;
    }
    case 'poly': {
      const m = new THREE.MeshStandardMaterial({ map: glassTexture(s.look === 'glassRect'), emissiveMap: glassTexture(s.look === 'glassRect'), emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.15, transparent: true, opacity: 0.92 });
      const p = extrude(s.pts, s.t, m);
      // Map UVs from the polygon bounds.
      const geo = p.geometry as THREE.BufferGeometry;
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const pa = geo.getAttribute('position');
      const uv = new Float32Array(pa.count * 2);
      for (let i = 0; i < pa.count; i++) {
        uv[i * 2] = (pa.getX(i) - bb.min.x) / (bb.max.x - bb.min.x);
        uv[i * 2 + 1] = (pa.getY(i) - bb.min.y) / (bb.max.y - bb.min.y);
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.add(p);
      const rim = new THREE.LineSegments(new THREE.EdgesGeometry(geo), mat('lead', () => new THREE.LineBasicMaterial({ color: '#222' })));
      g.add(rim);
      break;
    }
    case 'key': {
      const l = s.l;
      const t = l * 0.08;
      const bow = new THREE.Shape();
      bow.absarc(-l * 0.32, l * 0.21, l * 0.18, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(-l * 0.32, l * 0.21, l * 0.08, 0, Math.PI * 2, true);
      bow.holes.push(hole);
      const shaft = shapeFromPts([[-l * 0.16, l * 0.17], [l * 0.5, l * 0.17], [l * 0.5, l * 0.25], [-l * 0.16, l * 0.25]]);
      const bit = shapeFromPts([[l * 0.3, l * 0.0], [l * 0.42, l * 0.0], [l * 0.42, l * 0.17], [l * 0.3, l * 0.17]]);
      const bit2 = shapeFromPts([[l * 0.12, l * 0.05], [l * 0.22, l * 0.05], [l * 0.22, l * 0.17], [l * 0.12, l * 0.17]]);
      for (const sh of [bow, shaft, bit, bit2]) g.add(mesh(new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }), M.gold()));
      break;
    }
    case 'banner': {
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h * 0.92), new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.9, side: THREE.DoubleSide }));
      cloth.position.set(0, s.h * 0.46, 0.01);
      g.add(cloth);
      const rod = mesh(new THREE.CylinderGeometry(s.h * 0.025, s.h * 0.025, s.w * 1.1, 8), M.brass());
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0, s.h * 0.96, 0.01);
      g.add(rod);
      break;
    }
  }
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = true;
  });
  return g;
}

// ─────────────── room ───────────────

export interface TargetVisual {
  target: Target;
  group: THREE.Group;
  glow: THREE.Mesh | null;
  plate: THREE.Object3D;
}

export interface LevelView {
  root: THREE.Group;
  exhibitMeshes: Map<string, THREE.Group>;
  targets: Map<string, TargetVisual>;
  exit: THREE.Group;
  exitLight: THREE.PointLight;
  hides: THREE.Group[];
  alarmLights: THREE.PointLight[];
  lamps: THREE.PointLight[];
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  lasers: THREE.Object3D[];
  moonbeams: THREE.Object3D[];
  guard: Character;
  raccoon: Character;
  pedestals: Map<string, THREE.Object3D>;
  placards: Map<string, THREE.Mesh>;
  ventFans: THREE.Object3D[];
  dust: THREE.Points;
  sky: THREE.Texture;
}

const THEME_FOG: Record<string, string> = { lengths: '#0a1022', shadows: '#120c08', canvas: '#14070a', vault: '#06161a', rooftop: '#d99a86' };

export function buildLevel(level: Level): LevelView {
  const R = level.room;
  const root = new THREE.Group();
  const W = R.x1 - R.x0, D = R.z1 - R.z0;
  const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
  const roof = R.theme === 'rooftop';

  // Floor (split around pits).
  const fTex = floorTexture(R.theme).clone();
  fTex.wrapS = fTex.wrapT = THREE.RepeatWrapping;
  fTex.needsUpdate = true;
  const floorMat = new THREE.MeshStandardMaterial({ map: fTex, color: R.theme === 'shadows' ? '#a08a6c' : roof ? '#b89a8c' : '#ffffff', roughness: roof ? 0.6 : 0.32, metalness: 0.05, envMapIntensity: 1.0 });
  const floorRects: [number, number, number, number][] = [];
  const pits = R.pits ?? [];
  if (pits.length) {
    const p = pits[0];
    floorRects.push([R.x0, R.x1, R.z0, p.min[1]], [R.x0, R.x1, p.max[1], R.z1]);
    if (p.min[0] > R.x0) floorRects.push([R.x0, p.min[0], p.min[1], p.max[1]]);
    if (p.max[0] < R.x1) floorRects.push([p.max[0], R.x1, p.min[1], p.max[1]]);
  } else floorRects.push([R.x0, R.x1, R.z0, R.z1]);
  for (const [x0, x1, z0, z1] of floorRects) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    geo.rotateX(-Math.PI / 2);
    // World-space UVs: one 2 m texture tile.
    const pa = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < pa.count; i++) uv.setXY(i, (pa.getX(i) + (x0 + x1) / 2) / 2, (pa.getZ(i) + (z0 + z1) / 2) / 2);
    const f = new THREE.Mesh(geo, floorMat);
    f.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    f.receiveShadow = true;
    root.add(f);
  }
  for (const p of pits) {
    const pit = boxAt([p.min[0], -6, p.min[1]], [p.max[0], -0.01, p.max[1]], mat('pitWalls', () => new THREE.MeshStandardMaterial({ map: stoneBlockTexture('#3a3640'), color: '#5a5660', roughness: 0.95, side: THREE.BackSide })));
    pit.castShadow = false;
    // Brass lip along both edges of the chasm.
    root.add(boxAt([p.min[0], -0.02, p.min[1] - 0.06], [p.max[0], 0.03, p.min[1] + 0.02], M.brass()));
    root.add(boxAt([p.min[0], -0.02, p.max[1] - 0.02], [p.max[0], 0.03, p.max[1] + 0.06], M.brass()));
    root.add(pit);
    // Darkness layers: the deeper you look, the blacker it gets.
    for (const [y, op] of [[-0.5, 0.45], [-1.2, 0.55], [-2.2, 0.7], [-3.5, 0.85]] as [number, number][]) {
      const dark = new THREE.Mesh(new THREE.PlaneGeometry(p.max[0] - p.min[0], p.max[1] - p.min[1]), new THREE.MeshBasicMaterial({ color: '#000004', transparent: true, opacity: op, depthWrite: false }));
      dark.rotation.x = -Math.PI / 2;
      dark.position.set((p.min[0] + p.max[0]) / 2, y, (p.min[1] + p.max[1]) / 2);
      root.add(dark);
    }
    // Glowing chasm haze.
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(p.max[0] - p.min[0], p.max[1] - p.min[1]), new THREE.MeshBasicMaterial({ color: '#3a5cff', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    haze.rotation.x = -Math.PI / 2;
    haze.position.set((p.min[0] + p.max[0]) / 2, -3.0, (p.min[1] + p.max[1]) / 2);
    root.add(haze);
  }

  // Walls, wainscot, cornice, ceiling.
  if (!roof) {
    const wTex = wallTexture(R.theme);
    const walls: [number, number, number, number, number][] = [
      // cx, cz, length, yaw (facing into room), wall
      [cx, R.z0, W, 0, 0],
      [cx, R.z1, W, Math.PI, 0],
      [R.x0, cz, D, Math.PI / 2, 0],
      [R.x1, cz, D, -Math.PI / 2, 0],
    ];
    for (const [x, z, len, yaw] of walls) {
      const t = wTex.clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(len / 2.5, R.h / 2.5);
      t.needsUpdate = true;
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, R.h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }));
      wall.position.set(x, R.h / 2, z);
      wall.rotation.y = yaw;
      wall.receiveShadow = true;
      root.add(wall);
      const wain = mesh(new THREE.BoxGeometry(len, 1.0, 0.06), M.wood(), false);
      wain.position.set(x, 0.5, z);
      wain.rotation.y = yaw;
      wain.translateZ(0.03);
      root.add(wain);
      const rail = mesh(new THREE.BoxGeometry(len, 0.06, 0.1), M.brass(), false);
      rail.position.set(x, 1.02, z);
      rail.rotation.y = yaw;
      rail.translateZ(0.05);
      root.add(rail);
      const cornice = mesh(new THREE.BoxGeometry(len, 0.18, 0.2), M.darkBrass(), false);
      cornice.position.set(x, R.h - 0.09, z);
      cornice.rotation.y = yaw;
      cornice.translateZ(0.1);
      root.add(cornice);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: '#0d1020', roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(cx, R.h, cz);
    root.add(ceil);
    // Coffer beams.
    for (let x = R.x0 + 2; x < R.x1; x += 2) root.add(boxAt([x - 0.08, R.h - 0.25, R.z0], [x + 0.08, R.h, R.z1], M.wood()));
    // Skylight strip.
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(3, W / 3), D * 0.6), new THREE.MeshStandardMaterial({ color: '#1a2238', roughness: 0.3, metalness: 0.4 }));
    sky.rotation.x = Math.PI / 2;
    sky.position.set(cx, R.h - 0.01, cz);
    root.add(sky);
    // Paintings on side walls (decor, well above the wainscot).
    const arts: ('cat' | 'landscape' | 'portrait')[] = ['landscape', 'portrait', 'cat'];
    let ai = level.id;
    for (const side of [-1, 1]) {
      const x = side < 0 ? R.x0 + 0.04 : R.x1 - 0.04;
      for (let z = R.z0 + 2.5; z < R.z1 - 2; z += 4.5) {
        const occupied = level.props.some((p) => p.kind === 'window' && Math.abs(p.pos[0] - (side < 0 ? R.x0 : R.x1)) < 0.2 && Math.abs(p.pos[2] - z) < 2);
        if (occupied || Math.abs(z - level.guardDoor[1]) < 1.5) continue;
        const ph = Math.min(1.6, R.h - 2.3);
        if (ph < 0.6) continue;
        const pw = ph * 1.4;
        const frame = mesh(new THREE.BoxGeometry(0.06, ph + 0.16, pw + 0.16), M.gold(), false);
        frame.position.set(x, 1.3 + ph / 2 + 0.3, z);
        root.add(frame);
        const art = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: paintingTexture(arts[ai++ % 3]), roughness: 0.7 }));
        art.position.set(x - side * 0.035, 1.3 + ph / 2 + 0.3, z);
        art.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        root.add(art);
      }
    }
    // Marble pilasters with brass capitals along the walls (skipping doors, windows, wall targets).
    const avoid: V2[] = [level.guardDoor, [level.exit.pos[0], level.exit.pos[2]], ...level.targets.map((t) => [t.anchor[0], t.anchor[2]] as V2)];
    for (const pr of level.props) if (pr.kind === 'window') avoid.push([pr.pos[0], pr.pos[2]]);
    const pilMat = mat('pilaster', () => new THREE.MeshStandardMaterial({ map: marbleTexture('white'), color: R.theme === 'canvas' ? '#d8c4b4' : R.theme === 'vault' ? '#9fb8b4' : R.theme === 'shadows' ? '#c8b494' : '#c4c8d4', roughness: 0.3 }));
    const pilaster = (x: number, z: number, yaw: number) => {
      if (avoid.some((a) => Math.hypot(a[0] - x, a[1] - z) < 1.3)) return;
      if (level.props.some((pr) => pr.kind === 'solid' && x > pr.min[0] - 0.4 && x < pr.max[0] + 0.4 && z > pr.min[2] - 0.4 && z < pr.max[2] + 0.4 && pr.max[1] > 1.2)) return;
      const g = new THREE.Group();
      const shaft = mesh(new THREE.BoxGeometry(0.42, R.h - 0.6, 0.14), pilMat);
      shaft.position.set(0, (R.h - 0.6) / 2 + 0.3, 0.07);
      g.add(shaft);
      for (let i = -1; i <= 1; i++) {
        const flute = mesh(new THREE.BoxGeometry(0.05, R.h - 1.0, 0.03), M.darkBrass(), false);
        flute.position.set(i * 0.12, (R.h - 0.6) / 2 + 0.3, 0.15);
        g.add(flute);
      }
      const base = mesh(new THREE.BoxGeometry(0.54, 0.3, 0.22), M.darkBrass(), false);
      base.position.set(0, 0.15, 0.1);
      g.add(base);
      const cap = mesh(new THREE.BoxGeometry(0.6, 0.26, 0.26), M.brass(), false);
      cap.position.set(0, R.h - 0.43, 0.12);
      g.add(cap);
      g.position.set(x, 0, z);
      g.rotation.y = yaw;
      root.add(g);
    };
    for (let x = R.x0 + 1.6; x <= R.x1 - 1.6; x += 3.2) { pilaster(x, R.z0, 0); pilaster(x, R.z1, Math.PI); }
    for (let z = R.z0 + 1.6; z <= R.z1 - 1.6; z += 3.2) { pilaster(R.x0, z, Math.PI / 2); pilaster(R.x1, z, -Math.PI / 2); }
    // Chandeliers (not in the Hall of Shadows: one lamp, long shadows).
    if (R.theme !== 'shadows' && R.h >= 3.8) {
      const count = D > 13 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const z = count === 1 ? cz : cz + (i ? 1 : -1) * D / 4;
        const ch = new THREE.Group();
        const chain = mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6), M.darkBrass(), false);
        chain.position.y = 0.5;
        ch.add(chain);
        for (const [rr, yy, n] of [[0.55, 0, 10], [0.32, 0.22, 6]] as [number, number, number][]) {
          const ring = mesh(new THREE.TorusGeometry(rr, 0.025, 8, 36), M.brass(), false);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = yy;
          ch.add(ring);
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            const candle = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), mat('candle', () => new THREE.MeshStandardMaterial({ color: '#f4ead2', emissive: '#ffcf7a', emissiveIntensity: 0.6 })), false);
            candle.position.set(Math.cos(a) * rr, yy + 0.07, Math.sin(a) * rr);
            ch.add(candle);
            const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#ffc46a'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
            fl.scale.setScalar(0.16);
            fl.position.set(Math.cos(a) * rr, yy + 0.15, Math.sin(a) * rr);
            ch.add(fl);
          }
        }
        const drop = mesh(new THREE.SphereGeometry(0.09, 12, 8), mat('crystal', () => new THREE.MeshStandardMaterial({ color: '#dff4ff', roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.8 })), false);
        drop.position.y = -0.18;
        ch.add(drop);
        const light = new THREE.PointLight('#ffc27a', 7, 11, 1.4);
        light.position.y = 0.05;
        ch.add(light);
        ch.position.set(cx, R.h - 1.25, z);
        root.add(ch);
      }
    }
    // Guard door frame.
    const gd = level.guardDoor;
    const doorYaw = Math.abs(gd[0] - R.x0) < 0.4 ? Math.PI / 2 : Math.abs(gd[0] - R.x1) < 0.4 ? -Math.PI / 2 : Math.abs(gd[1] - R.z1) < 0.4 ? Math.PI : 0;
    const door = new THREE.Group();
    const dpanel = mesh(new THREE.BoxGeometry(1.3, 2.4, 0.05), M.wood(), false);
    dpanel.position.y = 1.2;
    door.add(dpanel);
    const darch = mesh(new THREE.TorusGeometry(0.7, 0.07, 6, 20, Math.PI), M.brass(), false);
    darch.position.y = 2.4;
    door.add(darch);
    for (const x of [-0.7, 0.7]) {
      const post = mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), M.brass(), false);
      post.position.set(x, 1.2, 0.03);
      door.add(post);
    }
    const sign = labelPlane(['שומר'], 0.5, 'dark');
    sign.position.set(0, 2.0, 0.06);
    door.add(sign);
    door.position.set(gd[0], 0, gd[1]);
    door.rotation.y = doorYaw;
    root.add(door);
  } else {
    // Rooftop: parapet, sky, city.
    const par = M.stone();
    root.add(boxAt([R.x0, 0, R.z0 - 0.4], [R.x1, 1.0, R.z0], par));
    root.add(boxAt([R.x0, 0, R.z1], [R.x1, 1.0, R.z1 + 0.4], par));
    root.add(boxAt([R.x0 - 0.4, 0, R.z0], [R.x0, 1.0, R.z1], par));
    root.add(boxAt([R.x1, 0, R.z0], [R.x1 + 0.4, 1.0, R.z1], par));
    const city = new THREE.Group();
    const r = (n: number) => (Math.sin(n * 12.9898) * 43758.5453) % 1;
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2;
      const dist = 34 + Math.abs(r(i)) * 20;
      const h = 6 + Math.abs(r(i + 7)) * 26;
      const ft = facadeTexture(i);
      const b = mesh(new THREE.BoxGeometry(4 + Math.abs(r(i + 3)) * 6, h, 4 + Math.abs(r(i + 5)) * 6), mat('city' + (i % 4), () => new THREE.MeshStandardMaterial({ map: ft, emissive: '#ffffff', emissiveMap: ft, emissiveIntensity: 0.35, roughness: 0.9 })), false);
      b.position.set(Math.sin(a) * dist, h / 2 - 8, Math.cos(a) * dist);
      city.add(b);
    }
    root.add(city);
    // Lamp posts on the parapet with string lights between them.
    const posts: V3[] = [];
    for (const [x0, z0, x1, z1] of [[R.x0, R.z0, R.x1, R.z0], [R.x1, R.z0, R.x1, R.z1], [R.x1, R.z1, R.x0, R.z1], [R.x0, R.z1, R.x0, R.z0]] as [number, number, number, number][]) {
      for (let t = 0; t < 1; t += 0.25) posts.push([x0 + (x1 - x0) * t, 1.0, z0 + (z1 - z0) * t]);
    }
    const bulbM = new THREE.SpriteMaterial({ map: glowSprite('#ffd890'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    posts.forEach((pp, i) => {
      const post = mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), M.darkBrass(), false);
      post.position.set(pp[0], pp[1] + 1.2, pp[2]);
      root.add(post);
      const lampHead = new THREE.Sprite(bulbM);
      lampHead.scale.setScalar(0.7);
      lampHead.position.set(pp[0], pp[1] + 2.45, pp[2]);
      root.add(lampHead);
      const nx = posts[(i + 1) % posts.length];
      for (let k = 1; k < 10; k++) {
        const t = k / 10;
        const bulb = new THREE.Sprite(bulbM);
        bulb.scale.setScalar(0.22);
        bulb.position.set(pp[0] + (nx[0] - pp[0]) * t, pp[1] + 2.3 - Math.sin(t * Math.PI) * 0.6, pp[2] + (nx[2] - pp[2]) * t);
        root.add(bulb);
      }
    });
    // Planters and lamps for the sculpture garden.
    for (const [x, z] of [[-10, -2], [10, 4], [-4, 10], [4, -11], [11, 11]] as V2[]) {
      const pl = buildExhibitMesh({ shape: { type: 'box', w: 1.2, h: 0.6, d: 1.2, look: 'planter' } });
      pl.position.set(x, 0, z);
      root.add(pl);
    }
  }

  // Props.
  const lasers: THREE.Object3D[] = [];
  const moonbeams: THREE.Object3D[] = [];
  for (const p of level.props) root.add(buildProp(p, level, lasers, moonbeams));

  // Display cases (decor; the sim has matching colliders).
  for (const d of decorCases(level)) {
    const g = new THREE.Group();
    const w = CASE_HALF * 2;
    g.add(boxAt([-CASE_HALF, 0, -CASE_HALF], [CASE_HALF, 0.95, CASE_HALF], M.wood()));
    g.add(boxAt([-CASE_HALF - 0.03, 0.92, -CASE_HALF - 0.03], [CASE_HALF + 0.03, 0.97, CASE_HALF + 0.03], M.brass()));
    const glassBox = new THREE.Mesh(new THREE.BoxGeometry(w, CASE_H - 0.97, w), M.glass());
    glassBox.position.y = 0.97 + (CASE_H - 0.97) / 2;
    g.add(glassBox);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(boxAt([x * CASE_HALF - 0.02, 0.97, z * CASE_HALF - 0.02], [x * CASE_HALF + 0.02, CASE_H, z * CASE_HALF + 0.02], M.brass()));
    g.add(boxAt([-CASE_HALF - 0.02, CASE_H, -CASE_HALF - 0.02], [CASE_HALF + 0.02, CASE_H + 0.05, CASE_HALF + 0.02], M.brass()));
    if (d.item === 'bust') {
      const b = modelInstance('bust', 0.5);
      b.position.y = 0.97;
      g.add(b);
    } else {
      // A lathe vase or a big gem on a cushion.
      const pts = d.item === 'vase' ? [[0.0, 0], [0.12, 0.02], [0.16, 0.18], [0.1, 0.38], [0.07, 0.46], [0.1, 0.52]] : [[0, 0], [0.15, 0.08], [0.0, 0.3]];
      const lathe = mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 20), d.item === 'vase' ? mat('porcelain', () => new THREE.MeshStandardMaterial({ color: '#e9edf5', roughness: 0.25, metalness: 0.05 })) : mat('gem', () => new THREE.MeshStandardMaterial({ color: '#4ad1ff', roughness: 0.05, metalness: 0.2, emissive: '#0a5a80', emissiveIntensity: 0.6, flatShading: true })));
      lathe.position.y = 1.0;
      g.add(lathe);
      if (d.item === 'vase') {
        const band = mesh(new THREE.TorusGeometry(0.155, 0.012, 6, 24), M.brass(), false);
        band.rotation.x = Math.PI / 2;
        band.position.y = 1.18;
        g.add(band);
      }
    }
    g.position.set(d.pos[0], 0, d.pos[1]);
    g.rotation.y = d.yaw;
    root.add(g);
  }

  // Pedestals + exhibits + placards.
  const exhibitMeshes = new Map<string, THREE.Group>();
  const pedestals = new Map<string, THREE.Object3D>();
  const placards = new Map<string, THREE.Mesh>();
  for (const ex of level.exhibits) {
    const mm = buildExhibitMesh(ex, ex.orientation ?? 0);
    exhibitMeshes.set(ex.id, mm);
    root.add(mm);
    const b = localBounds(ex.shape, ex.initialScale ?? 1, ex.orientation ?? 0);
    const hw = Math.max(0.3, (b.max[0] - b.min[0]) / 2 + 0.12);
    const hd = Math.max(0.3, (b.max[2] - b.min[2]) / 2 + 0.12);
    let placardHost: THREE.Vector3;
    if (ex.pedestal > 0) {
      const ped = new THREE.Group();
      const body = boxAt([-hw, 0, -hd], [hw, ex.pedestal - 0.05, hd], M.marble());
      ped.add(body);
      ped.add(boxAt([-hw - 0.05, 0, -hd - 0.05], [hw + 0.05, 0.1, hd + 0.05], M.marble()));
      ped.add(boxAt([-hw - 0.03, ex.pedestal - 0.05, -hd - 0.03], [hw + 0.03, ex.pedestal, hd + 0.03], M.brass()));
      ped.position.set(ex.pos[0], 0, ex.pos[1]);
      root.add(ped);
      pedestals.set(ex.id, ped);
      placardHost = new THREE.Vector3(ex.pos[0], ex.pedestal * 0.55, ex.pos[1]);
    } else {
      placardHost = new THREE.Vector3(ex.pos[0], 0.9, ex.pos[1]);
    }
    // Placard faces the pad (where the player grabs from), else the spawn.
    const pad = level.pads.find((p) => p.forId === ex.id);
    const face: V2 = pad ? pad.pos : level.spawn.pos;
    const yaw = Math.atan2(face[0] - ex.pos[0], face[1] - ex.pos[1]);
    const plq = labelPlane(ex.placard, 0.62, 'brass');
    const off = ex.pedestal > 0 ? Math.max(hw, hd) + 0.012 : Math.max(hw, hd) + 0.35;
    plq.position.copy(placardHost).add(new THREE.Vector3(Math.sin(yaw) * off, 0, Math.cos(yaw) * off));
    plq.rotation.y = yaw;
    if (ex.pedestal <= 0) {
      const post = boxAt([-0.03, 0, -0.03], [0.03, 0.75, 0.03], M.brass());
      post.position.add(new THREE.Vector3(plq.position.x, 0, plq.position.z).sub(new THREE.Vector3(Math.sin(yaw) * 0.02, 0, Math.cos(yaw) * 0.02)));
      root.add(post);
      plq.rotation.x = -0.35;
    }
    root.add(plq);
    placards.set(ex.id, plq);
    // Warm spot on each exhibit.
    const spot = new THREE.SpotLight('#ffc874', 11, 9, 0.42, 0.6, 1.2);
    spot.position.set(ex.pos[0] + 0.5, Math.min(R.h - 0.2, 5), ex.pos[1] + 0.8);
    spot.target.position.set(ex.pos[0], ex.pedestal, ex.pos[1]);
    root.add(spot, spot.target);
  }

  // Grab pads.
  for (const pad of level.pads) {
    const ex = level.exhibits.find((e) => e.id === pad.forId)!;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: padTexture(pad.d), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.atan2(ex.pos[0] - pad.pos[0], ex.pos[1] - pad.pos[1]) + Math.PI;
    m.position.set(pad.pos[0], 0.012, pad.pos[1]);
    root.add(m);
  }

  // Rulers.
  for (const r of level.rulers) {
    const len = r.to - r.from;
    const geo = new THREE.PlaneGeometry(0.16, len);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: rulerTexture(r.from, r.to), roughness: 0.3, metalness: 0.7, emissive: '#ffffff', emissiveMap: rulerTexture(r.from, r.to), emissiveIntensity: 0.18 }));
    m.rotation.order = 'YXZ';
    m.rotation.y = r.dir + Math.PI;
    m.rotation.x = -Math.PI / 2;
    const mid = (r.from + r.to) / 2;
    m.position.set(r.origin[0] + Math.sin(r.dir) * mid, 0.008, r.origin[1] + Math.cos(r.dir) * mid);
    m.receiveShadow = true;
    root.add(m);
  }

  // Targets, each under its own warm spotlight so it reads as the focal point.
  const targets = new Map<string, TargetVisual>();
  for (const t of level.targets) {
    targets.set(t.id, buildTarget(t, level, root));
    const fwd = new THREE.Vector3(Math.sin(t.yaw), 0, Math.cos(t.yaw));
    const sp = new THREE.SpotLight('#ffd9a0', 10, 12, 0.5, 0.75, 1.6);
    const c = new THREE.Vector3(...t.zone.c);
    sp.position.copy(c).addScaledVector(fwd, 2.2).setY(Math.min(R.h - 0.3, c.y + 4.2));
    sp.target.position.copy(c);
    root.add(sp, sp.target);
  }

  // Hide spots.
  const hides: THREE.Group[] = [];
  for (const h of level.hides) {
    const g = new THREE.Group();
    const sar = modelInstance('sarcophagus', 1.0);
    const box = new THREE.Box3().setFromObject(sar);
    const sz = box.getSize(new THREE.Vector3());
    if (sz.y > Math.max(sz.x, sz.z)) {
      g.add(modelInstance('sarcophagus', 2.1));
    } else {
      g.add(sar);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.05, 40), new THREE.MeshBasicMaterial({ color: '#ffcf5a', transparent: true, opacity: 0.35, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    g.add(ring);
    const lbl = labelPlane(['מחבוא'], 0.5, 'dark');
    lbl.position.set(0, 2.35, 0);
    g.add(lbl);
    g.userData.label = lbl;
    g.position.set(h[0], 0, h[1]);
    g.rotation.y = Math.atan2(level.spawn.pos[0] - h[0], level.spawn.pos[1] - h[1]);
    root.add(g);
    hides.push(g);
  }

  // Exit portal.
  const exit = new THREE.Group();
  const arch = mesh(new THREE.TorusGeometry(level.exit.r * 0.9, 0.07, 10, 40, Math.PI), M.gold(), false);
  arch.position.y = 1.4;
  exit.add(arch);
  for (const x of [-level.exit.r * 0.9, level.exit.r * 0.9]) {
    const post = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 10), M.gold(), false);
    post.position.set(x, 0.7, 0);
    exit.add(post);
  }
  const portal = new THREE.Mesh(new THREE.CircleGeometry(level.exit.r * 0.85, 32), new THREE.MeshBasicMaterial({ color: '#ffd77a', transparent: true, opacity: 0.0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  portal.position.y = 1.2;
  portal.scale.y = 1.3;
  exit.add(portal);
  exit.userData.portal = portal;
  const exitSign = labelPlane(['יציאה'], 0.6, 'dark');
  exitSign.position.y = 2.55;
  exit.add(exitSign);
  exit.position.set(level.exit.pos[0], level.exit.pos[1], level.exit.pos[2]);
  exit.rotation.y = Math.atan2(cx - level.exit.pos[0], cz - level.exit.pos[2]);
  const exitLight = new THREE.PointLight('#ffcf6a', 0, 6, 1.5);
  exitLight.position.set(0, 1.5, 0.4);
  exit.add(exitLight);
  root.add(exit);

  // Lights.
  const sky = skyTexture(roof ? 'rooftop' : 'night');
  const shadowHall = R.theme === 'shadows';
  const hemi = new THREE.HemisphereLight(roof ? '#ffd9c4' : shadowHall ? '#6a4a2a' : '#4a64b8', roof ? '#6a4a5a' : '#120e0a', roof ? 0.3 : shadowHall ? 0.35 : 0.8);
  root.add(hemi);
  const sunElev = ((level.sun?.elevation ?? 55) * Math.PI) / 180;
  const sunDir = level.sun?.shadowDir ?? 0.6;
  const sun = new THREE.DirectionalLight(roof ? '#ffc79a' : level.sun ? '#ffcf8a' : '#8fb0ff', roof ? 4.2 : level.sun ? 3.4 : 1.9);
  const span = Math.max(W, D);
  const tgt = new THREE.Vector3(cx, 0, cz);
  sun.position.set(cx - Math.sin(sunDir) * Math.cos(sunElev) * span, Math.sin(sunElev) * span, cz - Math.cos(sunDir) * Math.cos(sunElev) * span);
  sun.target.position.copy(tgt);
  sun.castShadow = true;
  sun.shadow.mapSize.set(roof ? 4096 : 2048, roof ? 4096 : 2048);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -span * 0.75; sc.right = span * 0.75; sc.top = span * 0.75; sc.bottom = -span * 0.75;
  sc.near = 0.5; sc.far = span * 3;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.05;
  root.add(sun, sun.target);
  if (roof) {
    const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#fff0c0'), color: '#ffe2a8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sunDisc.scale.setScalar(26);
    sunDisc.position.copy(sun.position).sub(tgt).normalize().multiplyScalar(90).add(tgt);
    root.add(sunDisc);
  }
  if (shadowHall && level.sun) {
    // The single low lamp the shadows come from (a brass searchlight high on the far wall).
    const lampG = new THREE.Group();
    const housing = mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.7, 20), M.brass(), false);
    housing.rotation.x = Math.PI / 2;
    lampG.add(housing);
    const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#ffd27a'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glowS.scale.setScalar(2.6);
    glowS.position.z = 0.4;
    lampG.add(glowS);
    // Back along the light direction from the room centre, kept inside the room.
    const back = new THREE.Vector3(-Math.sin(sunDir) * Math.cos(sunElev), Math.sin(sunElev), -Math.cos(sunDir) * Math.cos(sunElev));
    const dist = (R.h - 0.8) / Math.sin(sunElev);
    const p0 = tgt.clone().addScaledVector(back, dist);
    p0.x = Math.min(R.x1 - 0.6, Math.max(R.x0 + 0.6, p0.x));
    p0.z = Math.min(R.z1 - 0.6, Math.max(R.z0 + 0.6, p0.z));
    lampG.position.copy(p0);
    lampG.lookAt(tgt);
    root.add(lampG);
  }

  const lamps: THREE.PointLight[] = [];
  if (!roof && R.theme !== 'shadows') {
    const lampPos: V3[] = [[R.x0 + 0.5, 2.4, cz - D / 4], [R.x1 - 0.5, 2.4, cz + D / 4], [cx, R.h - 0.6, R.z0 + 1]];
    for (const p of lampPos) {
      // Sconces glow; only the first one is a real light (keeps the light count phone-friendly).
      const l = new THREE.PointLight('#ffa64a', lamps.length === 0 ? 5 : 0, 8, 1.6);
      l.position.set(p[0], p[1], p[2]);
      if (lamps.length === 0) root.add(l);
      lamps.push(l);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#ffb35a'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(0.6);
      glow.position.copy(l.position);
      root.add(glow);
      const sconce = mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.25, 10), M.brass(), false);
      sconce.position.set(p[0], p[1] - 0.2, p[2]);
      root.add(sconce);
    }
  }
  const alarmLights: THREE.PointLight[] = [];
  for (const p of [[R.x0 + 1, Math.min(R.h - 0.4, 3), R.z0 + 1], [R.x1 - 1, Math.min(R.h - 0.4, 3), R.z1 - 1]] as V3[]) {
    const l = new THREE.PointLight('#ff1a1a', 0, 18, 1.2);
    l.position.set(p[0], p[1], p[2]);
    root.add(l);
    alarmLights.push(l);
  }

  const guard = new Character('guard', 1.75);
  guard.root.visible = false;
  // Flashlight: a floor decal showing exactly where the guard can see (matches the sim's cone).
  const coneLen = 5.5, coneHalf = (45 * Math.PI) / 180;
  const fanGeo = new THREE.CircleGeometry(coneLen, 40, -Math.PI / 2 - coneHalf, 2 * coneHalf);
  fanGeo.rotateX(-Math.PI / 2);
  const fan = new THREE.Mesh(fanGeo, new THREE.MeshBasicMaterial({ map: glowSprite('#fff2b0'), color: '#fff6c8', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  fan.position.y = 0.03;
  fan.name = 'flashlight';
  guard.root.add(fan);
  // The "too close" circle: he notices you within 1.4 m even from behind.
  const near = new THREE.Mesh(new THREE.RingGeometry(1.32, 1.4, 48), new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.55, depthWrite: false }));
  near.rotation.x = -Math.PI / 2;
  near.position.y = 0.035;
  guard.root.add(near);
  const edgeGeo = new THREE.RingGeometry(coneLen - 0.08, coneLen, 40, 1, -Math.PI / 2 - coneHalf, 2 * coneHalf);
  edgeGeo.rotateX(-Math.PI / 2);
  const edge = new THREE.Mesh(edgeGeo, new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.6, depthWrite: false }));
  edge.position.y = 0.035;
  guard.root.add(edge);
  const torch = new THREE.SpotLight('#fff0c0', 18, coneLen + 1, coneHalf, 0.5, 1.2);
  torch.position.set(0.3, 1.1, 0.2);
  torch.target.position.set(0, 0, coneLen);
  guard.root.add(torch, torch.target);
  root.add(guard.root);
  const raccoon = new Character('raccoon', 0.7);
  raccoon.root.visible = false;
  root.add(raccoon.root);

  // Dust motes drifting through the light.
  const dn = 420;
  const dpos = new Float32Array(dn * 3);
  const rr = (n: number) => { const x = Math.sin(n * 12.9898 + level.id * 78.233) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < dn; i++) {
    dpos[i * 3] = R.x0 + rr(i) * W;
    dpos[i * 3 + 1] = 0.2 + rr(i + 1000) * Math.min(R.h, 8);
    dpos[i * 3 + 2] = R.z0 + rr(i + 2000) * D;
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: glowSprite('#ffffff'), color: roof ? '#ffe2c0' : '#cfdcff', size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  root.add(dust);

  const ventFans: THREE.Object3D[] = [];
  root.traverse((o) => { if (o.userData.fan) ventFans.push(o); });

  return { root, exhibitMeshes, targets, exit, exitLight, hides, alarmLights, lamps, sun, hemi, lasers, moonbeams, guard, raccoon, pedestals, placards, ventFans, dust, sky };
}

export function themeFog(level: Level): THREE.Color {
  return new THREE.Color(THEME_FOG[level.room.theme]);
}

function buildProp(p: Prop, level: Level, lasers: THREE.Object3D[], moonbeams: THREE.Object3D[]): THREE.Object3D {
  switch (p.kind) {
    case 'solid': {
      // Faces lying exactly on a room wall would z-fight with the wallpaper: pull them 1.5 cm in.
      const R0 = level.room;
      const nudge = (v: number, lo: number, hi: number) => (Math.abs(v - lo) < 0.02 ? lo + 0.015 : Math.abs(v - hi) < 0.02 ? hi - 0.015 : v);
      p = { ...p, min: [p.min[0], p.min[1], p.min[2]], max: [nudge(p.max[0], R0.x0, R0.x1), p.max[1], nudge(p.max[2], R0.z0, R0.z1)] };
      p.min[0] = nudge(p.min[0], R0.x0, R0.x1);
      p.min[2] = nudge(p.min[2], R0.z0, R0.z1);
      let m = { marble: M.marble(), stone: M.stone(), wood: M.wood(), brass: M.brass(), velvet: M.velvet(), steel: M.steel(), dark: M.dark() }[p.mat];
      const g = new THREE.Group();
      const sw = p.max[0] - p.min[0], sh = p.max[1] - p.min[1], sd = p.max[2] - p.min[2];
      const big = (p.mat === 'marble' || p.mat === 'stone') && sh > 1.2 && Math.max(sw, sd) > 2.5;
      if (big) {
        // Cut-stone faces with a brass cap instead of a blank slab.
        const t = (p.mat === 'stone' ? stoneBlockTexture('#7d7872') : panelTexture()).clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(Math.max(sw, sd) / (p.mat === 'stone' ? 3 : 2), p.mat === 'stone' ? sh / 1.6 : 1);
        t.needsUpdate = true;
        m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 });
        g.add(boxAt([p.min[0] - 0.02, p.max[1] - 0.12, p.min[2] - 0.02], [p.max[0] + 0.02, p.max[1], p.max[2] + 0.02], M.darkBrass()));
        g.add(boxAt([p.min[0] - 0.03, 0, p.min[2] - 0.03], [p.max[0] + 0.03, 0.18, p.max[2] + 0.03], M.dark()));
      }
      g.add(boxAt(p.min, p.max, m));
      if (p.walkable && p.max[1] > 1) {
        // Balustrade along the open edge facing the room centre.
        const R = level.room;
        const midZ = (R.z0 + R.z1) / 2;
        const edgeZ = Math.abs(p.max[2] - midZ) < Math.abs(p.min[2] - midZ) ? p.max[2] - 0.08 : p.min[2] + 0.08;
        const y = p.max[1];
        for (let x = p.min[0] + 0.3; x <= p.max[0] - 0.3; x += 0.45) {
          if (level.exit.pos[1] === y && Math.abs(x - level.exit.pos[0]) < 1.6) continue;
          const b = mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 8), M.marble());
          b.position.set(x, y + 0.4, edgeZ);
          g.add(b);
        }
        const rail = boxAt([p.min[0], y + 0.8, edgeZ - 0.08], [p.max[0], y + 0.9, edgeZ + 0.08], M.marble());
        g.add(rail);
      }
      return g;
    }
    case 'model': {
      const m = modelInstance(p.model, p.h);
      m.position.set(p.pos[0], p.pos[1], p.pos[2]);
      m.rotation.y = p.yaw;
      return m;
    }
    case 'mannequin': {
      const g = new THREE.Group();
      const cloth = mat('mannequin', () => new THREE.MeshStandardMaterial({ color: '#c8b28a', roughness: 0.8 }));
      const h = p.h;
      const stand = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 16), M.wood());
      stand.position.y = 0.02;
      g.add(stand);
      const pole = mesh(new THREE.CylinderGeometry(0.02, 0.02, h * 0.45, 8), M.brass());
      pole.position.y = h * 0.225;
      g.add(pole);
      const torso = mesh(new THREE.CapsuleGeometry(h * 0.1, h * 0.25, 6, 12), cloth);
      torso.position.y = h * 0.62;
      torso.scale.set(1.1, 1, 0.7);
      g.add(torso);
      const neck = mesh(new THREE.CylinderGeometry(0.03, 0.04, h * 0.06, 8), M.wood());
      neck.position.y = h * 0.86;
      g.add(neck);
      const head = mesh(new THREE.SphereGeometry(h * 0.06, 14, 10), M.wood());
      head.position.y = h - h * 0.06;
      g.add(head);
      g.position.set(p.pos[0], 0, p.pos[1]);
      const lbl = labelPlane(['בובת חייט', `גובה ⟦${p.h} מ'⟧`], 0.55, 'brass');
      lbl.position.set(0.4, 0.9, 0.1);
      lbl.rotation.x = -0.25;
      g.add(lbl);
      const post = boxAt([0.38, 0, 0.05], [0.42, 0.75, 0.09], M.brass());
      g.add(post);
      return g;
    }
    case 'laserLoop': {
      const g = new THREE.Group();
      const [x0, z0] = p.min, [x1, z1] = p.max;
      const segs: [V3, V3][] = [[[x0, p.y, z0], [x1, p.y, z0]], [[x1, p.y, z0], [x1, p.y, z1]], [[x1, p.y, z1], [x0, p.y, z1]], [[x0, p.y, z1], [x0, p.y, z0]]];
      for (const [a, b] of segs) {
        const beam = laserBeam(a, b, 0.012);
        g.add(beam);
      }
      for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
        const post = mesh(new THREE.CylinderGeometry(0.04, 0.05, p.y + 0.12, 10), M.brass());
        post.position.set(x, (p.y + 0.12) / 2, z);
        g.add(post);
      }
      lasers.push(g);
      return g;
    }
    case 'laserBeam': {
      const g = new THREE.Group();
      g.add(laserBeam(p.from, p.to, 0.01));
      const emitter = mesh(new THREE.BoxGeometry(0.25, 0.12, 0.25), M.steel());
      emitter.position.set(p.from[0], 0.06, p.from[2]);
      g.add(emitter);
      const spot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#ff3030'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      spot.scale.setScalar(0.35);
      spot.position.set(p.to[0] - 0.02, p.to[1], p.to[2]);
      g.add(spot);
      lasers.push(g);
      return g;
    }
    case 'rope': {
      const g = new THREE.Group();
      const a = new THREE.Vector3(...p.from), b = new THREE.Vector3(...p.to);
      if (a.y === 0 && b.y === 0) {
        // Velvet rope line on brass stanchions.
        const n = Math.max(2, Math.round(a.distanceTo(b) / 1.4) + 1);
        const posts: THREE.Vector3[] = [];
        for (let i = 0; i < n; i++) posts.push(a.clone().lerp(b, i / (n - 1)));
        for (const q of posts) {
          const post = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.95, 10), M.brass());
          post.position.set(q.x, 0.475, q.z);
          g.add(post);
          const knob = mesh(new THREE.SphereGeometry(0.055, 10, 8), M.brass());
          knob.position.set(q.x, 0.97, q.z);
          g.add(knob);
          const base = mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.04, 14), M.brass());
          base.position.set(q.x, 0.02, q.z);
          g.add(base);
        }
        for (let i = 0; i < n - 1; i++) {
          const p0 = posts[i].clone().setY(0.9), p1 = posts[i + 1].clone().setY(0.9);
          const mid = p0.clone().lerp(p1, 0.5).setY(0.7);
          const curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
          g.add(mesh(new THREE.TubeGeometry(curve, 12, 0.025, 6, false), M.velvet()));
        }
      } else {
        // A taut rope (level 10 geometry).
        const curve = new THREE.LineCurve3(a, b);
        g.add(mesh(new THREE.TubeGeometry(curve, 2, 0.035, 8, false), mat('rope', () => new THREE.MeshStandardMaterial({ color: '#c9a36a', roughness: 0.9 }))));
        // Banner pole whose top touches the rope.
        if (level.id === 10) {
          const pole = boxAt([-3.04, 0, 0.96], [-2.96, 1.5, 1.04], M.brass());
          g.add(pole);
          const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({ map: bannerTexture(), side: THREE.DoubleSide }));
          cloth.position.set(-3, 1.05, 1);
          cloth.rotation.y = Math.PI / 2;
          cloth.translateX(0.27);
          g.add(cloth);
        }
      }
      return g;
    }
    case 'moonbeam': {
      const a = new THREE.Vector3(...p.from), b = new THREE.Vector3(...p.to);
      const len = a.distanceTo(b);
      const geo = new THREE.CylinderGeometry(p.w * 0.45, p.w * 0.6, len, 4, 1, true);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#9fc4ff', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.copy(a.clone().lerp(b, 0.5));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.rotateY(Math.PI / 4);
      const g = new THREE.Group();
      g.add(m);
      const sensor = new THREE.Mesh(new THREE.CircleGeometry(0.35, 24), new THREE.MeshBasicMaterial({ color: '#bfe0ff', transparent: true, opacity: 0.6 }));
      sensor.rotation.x = -Math.PI / 2;
      sensor.position.set(b.x, 0.012, b.z);
      g.add(sensor);
      moonbeams.push(g);
      return g;
    }
    case 'camera': {
      const g = new THREE.Group();
      const pole = boxAt([-0.05, 0, -0.05], [0.05, p.pos[1], 0.05], M.steel());
      g.add(pole);
      const body = mesh(new THREE.BoxGeometry(0.3, 0.22, 0.5), mat('cam', () => new THREE.MeshStandardMaterial({ color: '#e8e8e8', roughness: 0.4 })));
      body.position.set(0, p.pos[1] + 0.1, 0);
      g.add(body);
      const lensM = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), M.dark());
      lensM.rotation.x = Math.PI / 2;
      lensM.position.set(0, p.pos[1] + 0.1, -0.28);
      g.add(lensM);
      const led = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#ff3030'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      led.scale.setScalar(0.18);
      led.position.set(0.1, p.pos[1] + 0.2, -0.26);
      g.add(led);
      g.position.set(p.pos[0], 0, p.pos[2]);
      g.rotation.y = p.yaw;
      return g;
    }
    case 'sign': {
      const s = labelPlane(p.lines, p.w ?? 1, 'brass');
      s.position.set(p.pos[0], p.pos[1], p.pos[2]);
      s.rotation.y = p.yaw;
      return s;
    }
    case 'window': {
      const g = new THREE.Group();
      const glassM = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshBasicMaterial({ map: skyTexture('night'), color: '#9cb8ff' }));
      g.add(glassM);
      for (let i = 1; i < 3; i++) g.add(boxAt([-p.w / 2, -p.h / 2 + (p.h * i) / 3 - 0.02, 0], [p.w / 2, -p.h / 2 + (p.h * i) / 3 + 0.02, 0.04], M.dark()));
      g.add(boxAt([-0.02, -p.h / 2, 0], [0.02, p.h / 2, 0.04], M.dark()));
      const frame = mesh(new THREE.TorusGeometry(p.w / 2, 0.06, 6, 24, Math.PI), M.darkBrass(), false);
      frame.position.y = p.h / 2;
      g.add(frame);
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 1.2, 6), new THREE.MeshBasicMaterial({ map: shaftTexture(), color: '#7fa6ff', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.set(0, -1.6, 2.4);
      beam.rotation.x = -0.9;
      g.add(beam);
      g.position.set(p.pos[0], p.pos[1], p.pos[2]);
      g.rotation.y = p.yaw;
      g.translateZ(0.02);
      moonbeams.push(beam);
      return g;
    }
  }
}

export function laserBeam(a: V3, b: V3, r: number): THREE.Mesh {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6, 1, true), M.laser());
  m.position.copy(va.clone().lerp(vb, 0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}

// ─────────────── targets ───────────────

function exactBounds(t: Target, level: Level) {
  const ex = level.exhibits.find((e) => e.id === t.accepts)!;
  const w = kWindow(ex.measures[t.measure], t.need, ex.initialScale ?? 1);
  return localBounds(ex.shape, (ex.initialScale ?? 1) * w.k, t.orientation ?? 0);
}

function buildTarget(t: Target, level: Level, root: THREE.Group): TargetVisual {
  const g = new THREE.Group();
  g.position.set(t.anchor[0], t.anchor[1], t.anchor[2]);
  g.rotation.y = t.yaw;
  const ex = level.exhibits.find((e) => e.id === t.accepts)!;
  const b = exactBounds(t, level);
  const w = b.max[0] - b.min[0], h = b.max[1] - b.min[1], d = b.max[2] - b.min[2];
  let glow: THREE.Mesh | null = null;
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const frameBar = (x0: number, y0: number, x1: number, y1: number, z: number, th = 0.05) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bar = mesh(new THREE.BoxGeometry(len + th, th, th), M.brass(), false);
    bar.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
    bar.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    g.add(bar);
  };
  const floorOutline = (y = 0.01) => {
    const th = 0.05;
    for (const [x0, z0, x1, z1] of [[b.min[0], b.min[2], b.max[0], b.min[2]], [b.max[0], b.min[2], b.max[0], b.max[2]], [b.max[0], b.max[2], b.min[0], b.max[2]], [b.min[0], b.max[2], b.min[0], b.min[2]]]) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const bar = mesh(new THREE.BoxGeometry(len + th, 0.02, th), M.brass(), false);
      bar.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      bar.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      g.add(bar);
    }
  };
  switch (t.socket) {
    case 'niche': {
      // Dark recess backdrop with an arched top on the mezzanine face.
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 1.6), M.dark());
      back.position.set(0, 0.8, b.min[2] - 0.002);
      g.add(back);
      const arch = mesh(new THREE.TorusGeometry(0.79, 0.05, 6, 20, Math.PI), M.brass(), false);
      arch.position.set(0, 1.6, b.min[2] + 0.05);
      g.add(arch);
      floorOutline();
      glow = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glowMat);
      glow.position.y = h / 2;
      break;
    }
    case 'vent': {
      const size = 0.8;
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(size, size), M.void());
      hole.position.set(0, size / 2, -0.385);
      g.add(hole);
      frameBar(-size / 2, 0, size / 2, 0, -0.37);
      frameBar(-size / 2, size, size / 2, size, -0.37);
      frameBar(-size / 2, 0, -size / 2, size, -0.37);
      frameBar(size / 2, 0, size / 2, size, -0.37);
      const fan = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const blade = mesh(new THREE.BoxGeometry(0.06, 0.32, 0.01), M.steel(), false);
        blade.position.y = 0.16;
        const arm = new THREE.Group();
        arm.add(blade);
        arm.rotation.z = (i * Math.PI) / 2;
        fan.add(arm);
      }
      fan.position.set(0, size / 2, -0.378);
      fan.userData.fan = true;
      g.add(fan);
      glow = new THREE.Mesh(new THREE.PlaneGeometry(size, size), glowMat);
      glow.position.set(0, size / 2, -0.36);
      break;
    }
    case 'gap': {
      glow = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), glowMat);
      glow.position.y = 0.02;
      break;
    }
    case 'plinth': {
      const ring = mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 24), M.brass(), false);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.01;
      g.add(ring);
      glow = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, h, 20, 1, true), glowMat);
      glow.position.y = h / 2;
      break;
    }
    case 'doorway': {
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.0), M.void());
      back.position.set(0, 1.5, -0.65);
      g.add(back);
      glow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.0), glowMat);
      glow.position.set(0, 1.5, -0.6);
      break;
    }
    case 'statueTop':
    case 'towerTop': {
      const crown = new THREE.Group();
      const band = mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.22, 16, 1, true), M.gold(), false);
      crown.add(band);
      for (let i = 0; i < 6; i++) {
        const spike = mesh(new THREE.ConeGeometry(0.06, 0.2, 6), M.gold(), false);
        const a = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.28, 0.2, Math.sin(a) * 0.28);
        crown.add(spike);
      }
      const gem = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#ffe28a'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      gem.scale.setScalar(0.9);
      crown.add(gem);
      // Top of the statue / tower: the exact needed height above the anchor.
      const top = t.need.value;
      crown.position.set(0, top + 0.12, t.socket === 'towerTop' ? -0.75 : -0.9);
      if (t.socket === 'towerTop') crown.position.set(0, top + 0.12, -0.75);
      g.add(crown);
      g.userData.crown = crown;
      glow = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.6), 0.05, Math.max(d, 0.6)), glowMat);
      glow.position.set(0, 0.02, d / 2);
      break;
    }
    case 'laserWall': {
      glow = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, 0.6), 0.4), glowMat);
      glow.position.set(0, 0.2, 0.02);
      break;
    }
    case 'frameTri':
    case 'framePoly': {
      // Brass panel with a hole of the exact needed shape.
      const pts = ex.shape.type === 'tri' ? trianglePoints(ex.shape.sides, t.orientation ?? 0) : ex.shape.type === 'poly' ? ex.shape.pts : [];
      const k = (ex.initialScale ?? 1) * kWindow(ex.measures[t.measure], t.need, ex.initialScale ?? 1).k;
      const hole = pts.map(([x, y]) => [x * k, y * k] as V2);
      const bx = Math.max(...hole.map((p) => Math.abs(p[0]))) + 0.18;
      const by = Math.max(...hole.map((p) => p[1])) + 0.18;
      const panel = new THREE.Shape();
      panel.moveTo(-bx, -0.12); panel.lineTo(bx, -0.12); panel.lineTo(bx, by); panel.lineTo(-bx, by); panel.closePath();
      const hp = new THREE.Path();
      hole.forEach(([x, y], i) => (i ? hp.lineTo(x, y) : hp.moveTo(x, y)));
      hp.closePath();
      panel.holes.push(hp);
      const pm = mesh(new THREE.ExtrudeGeometry(panel, { depth: 0.03, bevelEnabled: false }), mat('framePanel', () => new THREE.MeshStandardMaterial({ color: '#5a3a1a', roughness: 0.5, metalness: 0.3 })));
      pm.position.z = -0.005;
      g.add(pm);
      const back = new THREE.Mesh(new THREE.ShapeGeometry(shapeFromPts(hole)), M.void());
      back.position.z = -0.01;
      g.add(back);
      // Edge labels for the triangle frame (60, 80, 100).
      if (ex.shape.type === 'tri') {
        const labels = ex.shape.sides.map((sd) => String(Math.round(sd * k * 1000) / 10));
        const o = t.orientation ?? 0;
        for (let i = 0; i < 3; i++) {
          const a = hole[i], c = hole[(i + 1) % 3];
          const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.165), new THREE.MeshStandardMaterial({ map: numberTexture(labels[(o + i) % 3]), roughness: 0.6, emissive: '#ffffff', emissiveMap: numberTexture(labels[(o + i) % 3]), emissiveIntensity: 0.25 }));
          const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2;
          const cx2 = (hole[0][0] + hole[1][0] + hole[2][0]) / 3, cy2 = (hole[0][1] + hole[1][1] + hole[2][1]) / 3;
          lbl.position.set(mx - (cx2 - mx) * 0.25, my - (cy2 - my) * 0.25, 0.03);
          lbl.rotation.z = Math.atan2(c[1] - a[1], c[0] - a[0]);
          if (Math.abs(lbl.rotation.z) > Math.PI / 2) lbl.rotation.z += Math.PI;
          g.add(lbl);
        }
      }
      glow = new THREE.Mesh(new THREE.ShapeGeometry(shapeFromPts(hole)), glowMat);
      glow.position.z = 0.02;
      break;
    }
    case 'balcony': {
      glow = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.6), 0.05, Math.max(d, 0.6)), glowMat);
      glow.position.set(0, 0.02, d / 2);
      break;
    }
    case 'loop': {
      glow = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), glowMat);
      glow.position.y = 0.02;
      break;
    }
    case 'window': {
      // The moon window: exact similar shape to the painting at k.
      const win = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: skyTexture('night'), color: '#c8dcff' }));
      win.position.set(0, h / 2, -0.04);
      g.add(win);
      frameBar(-w / 2, 0, w / 2, 0, -0.02, 0.07);
      frameBar(-w / 2, h, w / 2, h, -0.02, 0.07);
      frameBar(-w / 2, 0, -w / 2, h, -0.02, 0.07);
      frameBar(w / 2, 0, w / 2, h, -0.02, 0.07);
      const sill = boxAt([-w / 2 - 0.1, -0.08, -0.05], [w / 2 + 0.1, 0, 0.12], M.marble());
      g.add(sill);
      glow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glowMat);
      glow.position.set(0, h / 2, 0.01);
      break;
    }
    case 'plate': {
      const slab = boxAt([b.min[0], 0, b.min[2]], [b.max[0], 0.02, b.max[2]], mat('plateM', () => new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.3, metalness: 0.8 })));
      g.add(slab);
      floorOutline(0.025);
      // Pressure grid.
      for (let x = b.min[0] + 0.25; x < b.max[0]; x += 0.25) g.add(boxAt([x - 0.005, 0.02, b.min[2]], [x + 0.005, 0.026, b.max[2]], M.darkBrass()));
      glow = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), glowMat);
      glow.position.y = 0.03;
      break;
    }
    case 'elevator': {
      const plat = boxAt([-1.1, 0, -1.1], [1.1, 0.06, 1.1], M.steel());
      g.add(plat);
      for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) g.add(boxAt([x - 0.04, 0, z - 0.04], [x + 0.04, 3.2, z + 0.04], M.brass()));
      g.add(boxAt([-1.15, 3.2, -1.15], [1.15, 3.3, 1.15], M.brass()));
      const dial = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), new THREE.MeshStandardMaterial({ color: '#f3ead2' }));
      dial.position.set(0, 2.6, -1.08);
      g.add(dial);
      const needle = mesh(new THREE.BoxGeometry(0.02, 0.26, 0.01), M.dark(), false);
      needle.position.set(0, 2.6, -1.07);
      needle.geometry.translate(0, 0.12, 0);
      g.add(needle);
      g.userData.needle = needle;
      glow = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 2.1), glowMat);
      glow.position.y = 0.07;
      break;
    }
    case 'keyhole': {
      const wheel = mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 32), M.brass(), false);
      wheel.position.set(0.95, 0.6, 0.02);
      g.add(wheel);
      for (let i = 0; i < 4; i++) {
        const spoke = mesh(new THREE.BoxGeometry(1.1, 0.05, 0.04), M.brass(), false);
        spoke.position.set(0.95, 0.6, 0.02);
        spoke.rotation.z = (i * Math.PI) / 4;
        g.add(spoke);
      }
      // A dark round escutcheon so the small key and keyhole read against the steel door.
      const plateK = mesh(new THREE.CircleGeometry(0.32, 40), mat('escutcheon', () => new THREE.MeshStandardMaterial({ color: '#141418', roughness: 0.6 })), false);
      plateK.position.set(0, 0.03, 0.004);
      g.add(plateK);
      const rimK = mesh(new THREE.TorusGeometry(0.32, 0.025, 8, 40), M.brass(), false);
      rimK.position.set(0, 0.03, 0.01);
      g.add(rimK);
      // Key silhouette at the original size.
      const sil = buildExhibitMesh({ shape: { type: 'key', l: 0.12 } });
      sil.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = M.void(); });
      sil.position.z = -0.005;
      sil.scale.z = 0.1;
      g.add(sil);
      glow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), glowMat);
      glow.position.set(0, 0.03, 0.02);
      break;
    }
    case 'billboard': {
      frameBar(-w / 2, 0, w / 2, 0, -0.03, 0.06);
      frameBar(-w / 2, h, w / 2, h, -0.03, 0.06);
      frameBar(-w / 2, 0, -w / 2, h, -0.03, 0.06);
      frameBar(w / 2, 0, w / 2, h, -0.03, 0.06);
      for (const x of [-w / 2, w / 2]) g.add(boxAt([x - 0.04, -t.anchor[1], -0.07], [x + 0.04, 0, 0.01], M.steel()));
      glow = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glowMat);
      glow.position.set(0, h / 2, 0.01);
      break;
    }
  }
  if (glow) g.add(glow);
  root.add(g);

  // Brass plate beside the target, facing into the room (local +z).
  const wallMounted = ['niche', 'vent', 'doorway', 'laserWall', 'frameTri', 'framePoly', 'window', 'keyhole'].includes(t.socket);
  const plate = labelPlane(t.plate, t.socket === 'niche' ? 1.25 : t.socket === 'framePoly' ? 0.5 : 0.95, 'brass');
  const side = Math.max(w / 2, 0.45) + 0.55;
  const local = new THREE.Vector3(-side, wallMounted ? 1.55 - t.anchor[1] : 1.05 - t.anchor[1], wallMounted ? Math.max(0.02, b.min[2] + 0.02) : 0);
  if (t.socket === 'niche') local.set(-1.75 - 0.4, 2.1, -0.75);
  if (t.socket === 'statueTop') local.set(-1.6, 1.2, 0.2);
  if (t.socket === 'towerTop') local.set(0, 1.4, 0.95);
  if (t.socket === 'vent') local.set(0.0, 1.6, -0.36);
  if (t.socket === 'balcony') local.set(-side, (level.props.find((p) => p.kind === 'solid' && p.walkable)?.kind === 'solid' ? 1.0 : 1.2), 0.04);
  if (t.socket === 'elevator') local.set(-1.6, 1.4, 0);
  if (t.socket === 'keyhole') local.set(-0.9, 0.35, 0.03);
  if (t.socket === 'framePoly') local.set(-0.75, 0.15, 0.25);
  const plateHolder = new THREE.Group();
  plateHolder.add(plate);
  plateHolder.position.copy(local);
  if (!wallMounted && !['statueTop', 'towerTop', 'balcony'].includes(t.socket)) {
    const post = boxAt([-0.03, -local.y - t.anchor[1], -0.03], [0.03, -0.15, 0.03], M.brass());
    plateHolder.add(post);
    plate.rotation.x = -0.3;
  }
  g.add(plateHolder);
  return { target: t, group: g, glow, plate: plateHolder };
}
