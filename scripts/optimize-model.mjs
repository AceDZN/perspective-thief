// Reduce a Tripo GLB for the web (adapted from goose-on-the-scale/scripts/optimize-model.mjs).
// Sloppy simplify (ignores UV seams, which block regular simplification on Tripo meshes),
// prune/dedup, resize textures to WebP, meshopt compression. Skins, joints and animations
// are kept untouched (only index buffers are rewritten, vertex attributes incl. JOINTS_0 /
// WEIGHTS_0 stay aligned via compactPrimitive).
//
// Usage (from repo root):
//   node scripts/optimize-model.mjs in.glb out.glb <targetTriangles> [textureSize] [maxError]
// Prints a summary (triangles, joints, animations, file size) at the end.
import { statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [, , input, output, targetArg = '12000', texArg = '1024', errArg = '0.02'] = process.argv;
if (!input || !output) {
  console.error('usage: node scripts/optimize-model.mjs in.glb out.glb <targetTriangles> [textureSize] [maxError]');
  process.exit(1);
}
const target = Number(targetArg);
const texSize = Number(texArg);

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(input);
await doc.transform(weld());

// Split the triangle budget across primitives proportionally to their size.
const prims = [];
for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices();
    if (prim.getAttribute('POSITION') && idx) prims.push({ mesh, prim, tris: idx.getCount() / 3 });
  }
}
const total = prims.reduce((s, p) => s + p.tris, 0);
for (const { mesh, prim, tris } of prims) {
  const budget = Math.max(200, Math.round((target * tris) / total));
  if (tris <= budget) continue;
  const positions = new Float32Array(prim.getAttribute('POSITION').getArray());
  const indices = new Uint32Array(prim.getIndices().getArray());
  const [out, err] = MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, budget * 3, Number(errArg));
  prim.getIndices().setArray(new Uint32Array(out));
  compactPrimitive(prim);
  console.log(`${mesh.getName() || 'mesh'}: ${tris} -> ${out.length / 3} triangles (error ${err.toFixed(4)})`);
}

await doc.transform(
  prune({ keepLeaves: true }),
  dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize], quality: 82 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(output, doc);

// Summary
const root = doc.getRoot();
let triangles = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) triangles += (p.getIndices()?.getCount() ?? 0) / 3;
const skins = root.listSkins();
console.log(
  JSON.stringify(
    {
      output,
      bytes: statSync(output).size,
      triangles,
      skins: skins.length,
      joints: skins[0]?.listJoints().length ?? 0,
      rootJoint: skins[0]?.listJoints()[0]?.getName() ?? null,
      animations: root.listAnimations().map((a) => a.getName()),
      textures: root.listTextures().map((t) => `${t.getMimeType()} ${t.getSize()?.join('x')}`),
    },
    null,
    2,
  ),
);
