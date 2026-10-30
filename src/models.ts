// Tripo GLB models (public/models/*.glb) with procedural stand-ins when a file is missing.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ModelId } from './levels.ts';
import { crateTexture, marbleTexture } from './textures.ts';

interface Loaded {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  box: THREE.Box3;
}

type AnyModel = ModelId | 'lensHand';
const loaded = new Map<AnyModel, Loaded>();
export const MODEL_IDS: AnyModel[] = ['guard', 'raccoon', 'lens', 'lensHand', 'dinoCrate', 'bust', 'statue', 'sarcophagus'];
const FILE: Record<AnyModel, string> = {
  lensHand: 'lens-hand.glb',
  guard: 'guard.glb',
  raccoon: 'raccoon.glb',
  lens: 'lens.glb',
  dinoCrate: 'dino-crate.glb',
  bust: 'bust.glb',
  statue: 'statue.glb',
  sarcophagus: 'sarcophagus.glb',
};

export function hasModel(id: AnyModel): boolean {
  return loaded.has(id);
}

export async function loadModels(onProgress?: (done: number, total: number) => void): Promise<void> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let done = 0;
  await Promise.all(
    MODEL_IDS.map(async (id) => {
      try {
        const url = new URL(`models/${FILE[id]}`, document.baseURI).href;
        const head = await fetch(url, { method: 'HEAD' });
        if (!head.ok || !(head.headers.get('content-type') ?? '').match(/gltf|octet|binary/)) throw new Error('missing');
        const gltf = await loader.loadAsync(url);
        gltf.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = true;
            m.receiveShadow = true;
            if (m.material && (m as THREE.SkinnedMesh).isSkinnedMesh) m.frustumCulled = false;
          }
        });
        gltf.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        loaded.set(id, { scene: gltf.scene, clips: gltf.animations, box });
      } catch {
        // Procedural stand-in is used.
      } finally {
        onProgress?.(++done, MODEL_IDS.length);
      }
    }),
  );
}

/** A model instance fitted to a height with its base at y = 0, centred on x/z. */
export function modelInstance(id: AnyModel, height: number): THREE.Group {
  const outer = new THREE.Group();
  const L = loaded.get(id);
  if (L) {
    const inner = (L.clips.length ? SkeletonUtils.clone(L.scene) : L.scene.clone(true)) as THREE.Group;
    const size = L.box.getSize(new THREE.Vector3());
    const s = height / Math.max(size.y, 1e-6);
    inner.scale.setScalar(s);
    inner.position.set(-((L.box.min.x + L.box.max.x) / 2) * s, -L.box.min.y * s, -((L.box.min.z + L.box.max.z) / 2) * s);
    outer.add(inner);
    outer.userData.clips = L.clips;
    outer.userData.inner = inner;
  } else {
    const p = procedural(id);
    const box = new THREE.Box3().setFromObject(p);
    const s = height / Math.max(box.max.y - box.min.y, 1e-6);
    p.scale.setScalar(s);
    p.position.y = -box.min.y * s;
    outer.add(p);
    outer.userData.procedural = true;
  }
  return outer;
}

/** Fit a model instance into a w × h × d box (non-uniform only if asked). */
export function modelInBox(id: ModelId, w: number, h: number, d: number): THREE.Group {
  const g = modelInstance(id, h);
  const box = new THREE.Box3().setFromObject(g);
  const sx = w / Math.max(box.max.x - box.min.x, 1e-6);
  const sz = d / Math.max(box.max.z - box.min.z, 1e-6);
  // Keep proportions but never exceed the footprint by more than 30 %.
  const k = Math.min(1, Math.max(sx, sz) * 1.3);
  if (k < 1) {
    g.scale.set(k, 1, k);
  }
  return g;
}

// ─────────────── animated characters ───────────────

export class Character {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  current = '';
  private t = 0;
  procedural: boolean;

  constructor(id: ModelId, height: number) {
    this.root = modelInstance(id, height);
    this.procedural = !!this.root.userData.procedural;
    const clips = (this.root.userData.clips ?? []) as THREE.AnimationClip[];
    if (clips.length) {
      this.mixer = new THREE.AnimationMixer(this.root.userData.inner as THREE.Object3D);
      for (const c of clips) {
        // Keep animations in place: drop horizontal root translation.
        const clip = c.clone();
        for (const tr of clip.tracks) {
          if (/Hips\.position$/i.test(tr.name) || /hips\.position$/i.test(tr.name)) {
            const v = tr.values;
            const x0 = v[0], z0 = v[2];
            for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
          }
        }
        this.actions.set(c.name.toLowerCase(), this.mixer.clipAction(clip));
      }
    }
  }

  clipNames(): string[] {
    return [...this.actions.keys()];
  }

  /** Play the first clip whose name contains one of the keywords. */
  play(keywords: string[], opts: { once?: boolean; fade?: number; speed?: number } = {}): void {
    const key = keywords.join('|');
    if (this.current === key) return;
    this.current = key;
    this.t = 0;
    if (!this.mixer) return;
    let action: THREE.AnimationAction | undefined;
    for (const k of keywords) {
      for (const [name, a] of this.actions) if (name.includes(k)) { action = a; break; }
      if (action) break;
    }
    if (!action) return;
    const fade = opts.fade ?? 0.25;
    for (const a of this.actions.values()) if (a !== action && a.isRunning()) a.fadeOut(fade);
    action.reset();
    action.setLoop(opts.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = !!opts.once;
    action.timeScale = opts.speed ?? 1;
    action.fadeIn(fade).play();
  }

  update(dt: number, moving = false): void {
    this.t += dt;
    if (this.mixer) {
      this.mixer.update(dt);
      return;
    }
    // Procedural waddle.
    const body = this.root.children[0];
    if (!body) return;
    const sp = this.current.includes('run') ? 14 : moving || this.current.includes('walk') ? 8 : 2;
    const amp = this.current.includes('run') ? 0.18 : moving || this.current.includes('walk') ? 0.12 : 0.03;
    body.rotation.z = Math.sin(this.t * sp) * amp;
    body.position.y = Math.abs(Math.sin(this.t * sp)) * amp * 0.4 * (body.scale.y || 1);
    if (this.current.includes('fall') || this.current.includes('dive')) body.rotation.x = Math.min(1.4, this.t * 4);
    else body.rotation.x = 0;
  }
}

// ─────────────── procedural stand-ins ───────────────

function std(color: string | number, rough = 0.6, metal = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function procedural(id: AnyModel): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  switch (id) {
    case 'guard': {
      const navy = std('#1f2a4a'), skin = std('#f0c49a'), black = std('#151515');
      add(new THREE.CapsuleGeometry(0.42, 0.55, 6, 16), navy, 0, 0.95);
      add(new THREE.SphereGeometry(0.27, 20, 16), skin, 0, 1.62);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 20), navy, 0, 1.86);
      add(new THREE.BoxGeometry(0.34, 0.03, 0.2), black, 0, 1.81, -0.22);
      add(new THREE.BoxGeometry(0.3, 0.07, 0.08), std('#3b2414'), 0, 1.55, -0.24);
      add(new THREE.CylinderGeometry(0.11, 0.1, 0.5, 10), navy, -0.17, 0.28);
      add(new THREE.CylinderGeometry(0.11, 0.1, 0.5, 10), navy, 0.17, 0.28);
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), std('#888', 0.3, 0.8), 0.5, 0.95, -0.15).rotation.x = Math.PI / 2;
      break;
    }
    case 'raccoon': {
      const grey = std('#7c7c84'), dark = std('#2a2a30'), light = std('#d6d6d6');
      add(new THREE.CapsuleGeometry(0.2, 0.25, 6, 12), grey, 0, 0.38);
      add(new THREE.SphereGeometry(0.19, 16, 12), grey, 0, 0.78);
      add(new THREE.BoxGeometry(0.3, 0.07, 0.05), dark, 0, 0.8, -0.16);
      add(new THREE.SphereGeometry(0.06, 10, 8), light, 0, 0.72, -0.18);
      add(new THREE.ConeGeometry(0.07, 0.12, 8), grey, -0.12, 0.98).rotation.z = 0.3;
      add(new THREE.ConeGeometry(0.07, 0.12, 8), grey, 0.12, 0.98).rotation.z = -0.3;
      const tail = add(new THREE.CapsuleGeometry(0.07, 0.4, 4, 8), dark, 0, 0.3, 0.3);
      tail.rotation.x = 1.0;
      add(new THREE.BoxGeometry(0.22, 0.26, 0.12), std('#222'), 0, 0.45, 0.17);
      break;
    }
    case 'lensHand':
    case 'lens': {
      const brass = std('#c9a24a', 0.3, 0.9), leather = std('#2a1a12', 0.8);
      const b = add(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 24), brass, 0, 0, 0);
      b.rotation.x = Math.PI / 2;
      const l = add(new THREE.CylinderGeometry(0.052, 0.052, 0.06, 24), leather, 0, 0, 0.07);
      l.rotation.x = Math.PI / 2;
      const r = add(new THREE.TorusGeometry(0.055, 0.008, 8, 24), brass, 0, 0, -0.05);
      void r;
      add(new THREE.CircleGeometry(0.047, 24), new THREE.MeshStandardMaterial({ color: '#9fd8ff', emissive: '#4aa8ff', emissiveIntensity: 1.2, roughness: 0.05, metalness: 0.2 }), 0, 0, -0.051).rotation.y = Math.PI;
      break;
    }
    case 'dinoCrate': {
      const wood = new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.8 });
      const bone = std('#e8dfc8', 0.7);
      // Slatted crate: frame + slats with gaps.
      for (const y of [0.05, 0.95]) for (const z of [-0.45, 0.45]) add(new THREE.BoxGeometry(1, 0.1, 0.1), wood, 0, y, z);
      for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) add(new THREE.BoxGeometry(0.1, 1, 0.1), wood, x, 0.5, z);
      for (const y of [0.05, 0.95]) for (const x of [-0.45, 0.45]) add(new THREE.BoxGeometry(0.1, 0.1, 1), wood, x, y, 0);
      for (let i = 0; i < 4; i++) {
        add(new THREE.BoxGeometry(0.06, 0.9, 0.96), wood, -0.47, 0.5, 0).position.z = -0.3 + i * 0.2;
      }
      add(new THREE.BoxGeometry(0.98, 0.04, 0.98), wood, 0, 0.02, 0);
      // Skull + ribs.
      add(new THREE.BoxGeometry(0.34, 0.22, 0.28), bone, 0.15, 0.62, -0.1);
      add(new THREE.BoxGeometry(0.2, 0.08, 0.26), bone, 0.36, 0.52, -0.1);
      for (let i = 0; i < 5; i++) {
        const rib = add(new THREE.TorusGeometry(0.16, 0.025, 6, 12, Math.PI), bone, -0.1 - i * 0.07, 0.42, 0.1);
        rib.rotation.y = Math.PI / 2;
      }
      break;
    }
    case 'bust': {
      const m = new THREE.MeshStandardMaterial({ map: marbleTexture('white'), roughness: 0.35 });
      add(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 20), m, 0, 0.06);
      add(new THREE.SphereGeometry(0.28, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.12).scale.set(1, 0.7, 0.7);
      add(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 12), m, 0, 0.34);
      add(new THREE.SphereGeometry(0.15, 20, 16), m, 0, 0.52).scale.set(0.9, 1.1, 1);
      add(new THREE.SphereGeometry(0.155, 16, 10, 0, Math.PI * 2, 0, 1.2), m, 0, 0.58, 0.02);
      break;
    }
    case 'statue': {
      const m = new THREE.MeshStandardMaterial({ map: marbleTexture('white'), roughness: 0.4 });
      add(new THREE.BoxGeometry(0.5, 0.12, 0.5), m, 0, 0.06);
      add(new THREE.CylinderGeometry(0.12, 0.2, 0.9, 16), m, 0, 0.57);
      add(new THREE.CylinderGeometry(0.17, 0.13, 0.5, 16), m, 0, 1.25);
      add(new THREE.SphereGeometry(0.11, 16, 12), m, 0, 1.62);
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), m, 0.2, 1.4).rotation.z = -0.5;
      add(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 12, 1, true), std('#e3c26a', 0.3, 0.9), 0, 1.74);
      break;
    }
    case 'sarcophagus': {
      const gold = std('#d1a640', 0.35, 0.85), blue = std('#1d3c8a', 0.5);
      add(new THREE.BoxGeometry(0.75, 0.6, 2.0), gold, 0, 0.3);
      add(new THREE.BoxGeometry(0.7, 0.18, 1.9), blue, 0, 0.66);
      add(new THREE.SphereGeometry(0.22, 16, 12), gold, 0, 0.8, -0.65).scale.set(1, 0.6, 1);
      for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.72, 0.03, 0.05), gold, 0, 0.76, -0.3 + i * 0.25);
      break;
    }
  }
  return g;
}
