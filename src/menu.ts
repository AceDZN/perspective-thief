// Level select: a miniature museum diorama on a planning table (mockup 04).
import * as THREE from 'three';
import { LEVELS, WORLDS } from './levels.ts';
import { Character, modelInstance } from './models.ts';
import { glowSprite, marbleTexture, paintingTexture, woodTexture } from './textures.ts';
import { boxAt, buildExhibitMesh, M } from './world.ts';

export interface MenuView {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  nodePos: Map<number, THREE.Vector3>;
  hallPos: Map<number, THREE.Vector3>;
  raccoon: Character;
  update(dt: number, current: number, reduced: boolean): void;
}

// Hall rectangles on the table (x0, z0, x1, z1) and their floor tint.
// Hebrew reads right to left: World 1 is the rightmost hall.
const HALLS: Record<number, { r: [number, number, number, number]; floor: string; wall: string }> = {
  1: { r: [5.2, -1, 10, 5], floor: 'white', wall: '#1d2a48' },
  2: { r: [0.2, -1, 5, 5], floor: 'grey', wall: '#3b2a1c' },
  3: { r: [-4.6, -1, 0, 5], floor: 'red', wall: '#4a1419' },
  4: { r: [-9, -1, -4.8, 5], floor: 'teal', wall: '#173c40' },
  5: { r: [-3, -6.5, 6, -1.6], floor: 'rose', wall: '#c9a58e' },
};

export function buildMenu(): MenuView {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07080f');
  scene.fog = new THREE.Fog('#07080f', 30, 60);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);

  // Table.
  const table = new THREE.Mesh(new THREE.BoxGeometry(34, 0.6, 22), new THREE.MeshStandardMaterial({ map: woodTexture(true), roughness: 0.5 }));
  (table.material as THREE.MeshStandardMaterial).map!.repeat.set(4, 3);
  (table.material as THREE.MeshStandardMaterial).map!.wrapS = (table.material as THREE.MeshStandardMaterial).map!.wrapT = THREE.RepeatWrapping;
  table.position.y = -0.3;
  table.receiveShadow = true;
  scene.add(table);
  // Blueprint sheet.
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshStandardMaterial({ color: '#2a3b5c', roughness: 0.9 }));
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.set(0.5, 0.005, -0.7);
  sheet.receiveShadow = true;
  scene.add(sheet);

  const hallPos = new Map<number, THREE.Vector3>();
  for (const w of WORLDS) {
    const h = HALLS[w.id];
    const [x0, z0, x1, z1] = h.r;
    const base = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.3, z1 - z0), new THREE.MeshStandardMaterial({ map: marbleTexture(h.floor as 'white'), roughness: 0.3 }));
    base.position.set((x0 + x1) / 2, 0.15, (z0 + z1) / 2);
    base.receiveShadow = true;
    base.castShadow = true;
    scene.add(base);
    const wallM = new THREE.MeshStandardMaterial({ color: h.wall, roughness: 0.8 });
    const wh = w.id === 5 ? 0.35 : 1.1;
    scene.add(boxAt([x0, 0.3, z0], [x1, 0.3 + wh, z0 + 0.15], wallM));
    scene.add(boxAt([x0, 0.3, z0], [x0 + 0.15, 0.3 + wh, z1], wallM));
    scene.add(boxAt([x1 - 0.15, 0.3, z0], [x1, 0.3 + wh, z1], wallM));
    scene.add(boxAt([x0, 0.3, z1 - 0.1], [x1, 0.3 + wh * 0.35, z1], wallM));
    hallPos.set(w.id, new THREE.Vector3((x0 + x1) / 2, 0.3 + wh + 0.35, z0 + 0.1));
    // A warm lamp per hall.
    const l = new THREE.PointLight(w.id === 5 ? '#ffb48a' : '#ffbf6a', 8, 8, 1.6);
    l.position.set((x0 + x1) / 2, 2.4, (z0 + z1) / 2);
    scene.add(l);
  }
  // Decorations.
  const put = (o: THREE.Object3D, x: number, z: number, y = 0.3, yaw = 0) => { o.position.set(x, y, z); o.rotation.y = yaw; scene.add(o); return o; };
  put(modelInstance('statue', 1.6), 8.6, 0.4);
  put(modelInstance('bust', 0.5), 6.0, 0.2, 0.3, 0.4);
  put(modelInstance('dinoCrate', 1.0), 3.6, 0.6, 0.3, 0.3);
  put(modelInstance('statue', 2.2), 1.0, 0.2, 0.3, -0.4);
  const painting = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.95), new THREE.MeshStandardMaterial({ map: paintingTexture('cat'), roughness: 0.6 }));
  put(painting, -2.3, -0.83, 1.0);
  const frame = boxAt([-0.78, -0.55, -0.04], [0.78, 0.55, 0], M.gold());
  put(frame, -2.3, -0.85, 1.0);
  put(modelInstance('sarcophagus', 1.1), -8.3, 0.3, 0.3, 0.2);
  const vault = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 10, 32), M.brass());
  put(vault, -6.4, -0.83, 1.0);
  const gold = buildExhibitMesh({ shape: { type: 'box', w: 0.5, h: 0.5, d: 0.5, look: 'gold' } });
  put(gold, -5.6, 2.6);
  for (const [x, z] of [[-2, -5.6], [4.8, -5.6], [-2, -2.4], [4.6, -2.4]] as [number, number][]) {
    put(buildExhibitMesh({ shape: { type: 'box', w: 0.7, h: 0.35, d: 0.7, look: 'planter' } }), x, z);
  }
  put(buildExhibitMesh({ shape: { type: 'box', w: 0.5, h: 2.4, d: 0.5, look: 'tower' } }), 3.6, -5.3);

  // Path + nodes.
  const nodePos = new Map<number, THREE.Vector3>();
  const perWorld = new Map<number, number[]>();
  for (const l of LEVELS) perWorld.set(l.world, [...(perWorld.get(l.world) ?? []), l.id]);
  for (const [wid, ids] of perWorld) {
    const [x0, z0, x1, z1] = HALLS[wid].r;
    ids.forEach((id, i) => {
      const t = ids.length === 1 ? 0.5 : i / (ids.length - 1);
      // Right to left inside each hall, zig-zagging between two rows.
      let x = x1 - 0.8 - t * (x1 - x0 - 1.6);
      let z = i % 2 ? z0 + 2.0 : z1 - 1.2;
      if (wid === 5) { x = (x0 + x1) / 2; z = (z0 + z1) / 2; }
      nodePos.set(id, new THREE.Vector3(x, 0.42, z));
    });
  }
  const pts = LEVELS.map((l) => nodePos.get(l.id)!);
  const dotM = new THREE.SpriteMaterial({ map: glowSprite('#ffcf6a'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const n = Math.max(2, Math.round(a.distanceTo(b) / 0.35));
    for (let j = 1; j < n; j++) {
      const s = new THREE.Sprite(dotM);
      s.scale.setScalar(0.22);
      s.position.copy(a).lerp(b, j / n);
      s.position.y = 0.36;
      scene.add(s);
    }
  }
  for (const p of pts) {
    const med = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.1, 24), M.brass());
    med.position.copy(p);
    med.castShadow = true;
    scene.add(med);
  }

  // Props on the table: big lens, coins.
  const lens = modelInstance('lens', 1.4);
  lens.position.set(5.5, 0, 8);
  lens.rotation.set(0, -0.6, 0);
  scene.add(lens);
  for (let i = 0; i < 5; i++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 20), M.gold());
    coin.position.set(-9 + i * 0.4, 0.03 + i * 0.05, 8.2 - i * 0.1);
    scene.add(coin);
  }

  const raccoon = new Character('raccoon', 0.8);
  scene.add(raccoon.root);
  raccoon.play(['idle', 'wave', 'cheer']);

  scene.add(new THREE.HemisphereLight('#6a80c8', '#1a1008', 0.9));
  const moon = new THREE.DirectionalLight('#a8c0ff', 1.6);
  moon.position.set(-8, 14, -6);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  const sc = moon.shadow.camera as THREE.OrthographicCamera;
  sc.left = -16; sc.right = 16; sc.top = 12; sc.bottom = -12;
  scene.add(moon);
  const desk = new THREE.PointLight('#ffb050', 5, 30, 1.5);
  desk.position.set(-12, 7, 9);
  scene.add(desk);

  let t = 0;
  return {
    scene,
    camera,
    nodePos,
    hallPos,
    raccoon,
    update(dt, current, reduced) {
      t += dt;
      const sway = reduced ? 0 : Math.sin(t * 0.25) * 0.6;
      const aspect = camera.aspect;
      // Fit the whole map: 23 m wide, 13 m deep, whatever the container's shape.
      const tf = Math.tan(((camera.fov / 2) * Math.PI) / 180);
      const dist = Math.max(19, (11.5 / (tf * aspect)) * 0.95, 7 / tf);
      camera.position.set(0.5 + sway, dist * 0.82, dist * 0.62 + 2);
      const fog = scene.fog as THREE.Fog;
      fog.near = dist * 1.1;
      fog.far = dist * 2.6;
      camera.lookAt(0.5, 0, 1.4);
      const p = nodePos.get(current);
      if (p) {
        raccoon.root.position.set(p.x + 0.45, 0.47, p.z + 0.1);
        raccoon.root.rotation.y = 0.4;
      }
      raccoon.update(dt, false);
    },
  };
}
