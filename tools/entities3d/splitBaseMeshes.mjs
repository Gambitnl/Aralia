/**
 * @file splitBaseMeshes.mjs — split the two CC-BY Sketchfab base-mesh packs
 * into one small GLB per model for the Part Lab body picker.
 *
 * Sources (gitignored, Remy's drop 2026-08-21):
 *   .agent/references/GLBs/base models glb/lowpoly_basemeshes_-_2026_-_fbx.glb
 *     "Lowpoly Basemeshes - 2026 - FBX" by Seifert (Peter_Seifert), CC-BY 4.0
 *   .agent/references/GLBs/base models glb/free_stylized_basemesh_for_blender_sculpting.glb
 *     "Free Stylized Basemesh for Blender Sculpting" by dacancino, CC-BY 4.0
 *
 * Output: public/references/basemesh/<id>.glb — world transforms baked, no
 * textures or materials (the lab paints the toon skin), normalized so the
 * model stands on y = 0, centered on x/z, with height 1. The lab scales it to
 * the entity's frame height (bodies) or skull size (the head kit).
 *
 * The model ids MUST match src/systems/entities3d/three/baseMeshCatalog.ts;
 * the script fails when a catalog id produces no mesh.
 *
 * Run: node tools/entities3d/splitBaseMeshes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, '')), '..', '..');
const SRC_DIR = path.join(ROOT, '.agent', 'references', 'GLBs', 'base models glb');
const OUT_DIR = path.join(ROOT, 'public', 'references', 'basemesh');
fs.mkdirSync(OUT_DIR, { recursive: true });

/** One output model: which source file, and which mesh nodes belong to it. */
const MODELS = [
  { id: 'lowpoly-nogender', src: 'lowpoly_basemeshes_-_2026_-_fbx.glb', pick: (n) => !n.getSkin() && n.getName().startsWith('00 AA BODY NO GENDER') },
  { id: 'lowpoly-female', src: 'lowpoly_basemeshes_-_2026_-_fbx.glb', pick: (n) => !n.getSkin() && n.getName().startsWith('FEMALE BODY TYPE 1.001') },
  { id: 'lowpoly-male', src: 'lowpoly_basemeshes_-_2026_-_fbx.glb', pick: (n) => !n.getSkin() && n.getName().startsWith('MALE BODY TYPE 1.003') },
  // the stylized pack is three models side by side: figure A at x ≈ −2.3,
  // figure B at x ≈ +2.5, and a detached head kit at x ≈ 0 (y 5.3–6.7)
  { id: 'stylized-figure-a', src: 'free_stylized_basemesh_for_blender_sculpting.glb', pick: (n, cx) => cx < -1 },
  { id: 'stylized-figure-b', src: 'free_stylized_basemesh_for_blender_sculpting.glb', pick: (n, cx) => cx > 1 },
  { id: 'stylized-head-kit', src: 'free_stylized_basemesh_for_blender_sculpting.glb', pick: (n, cx) => cx >= -1 && cx <= 1 },
];

// the stylized pack REQUIRES KHR_materials_pbrSpecularGlossiness; register the
// full extension set so the reader accepts both packs (materials are dropped)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const docs = new Map();
const load = async (file) => {
  if (!docs.has(file)) docs.set(file, await io.read(path.join(SRC_DIR, file)));
  return docs.get(file);
};

const mat4Apply = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

/** World AABB of a mesh node from its primitives' position bounds. */
function worldBounds(node) {
  const w = node.getWorldMatrix();
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (const prim of node.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const lo = pos.getMin([]);
    const hi = pos.getMax([]);
    for (const cx of [0, 1]) for (const cy of [0, 1]) for (const cz of [0, 1]) {
      const q = mat4Apply(w, [cx ? hi[0] : lo[0], cy ? hi[1] : lo[1], cz ? hi[2] : lo[2]]);
      for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], q[i]); mx[i] = Math.max(mx[i], q[i]); }
    }
  }
  return { mn, mx };
}

const manifest = [];
for (const model of MODELS) {
  const src = await load(model.src);
  const picked = src.getRoot().listNodes().filter((n) => {
    if (!n.getMesh()) return false;
    const b = worldBounds(n);
    return model.pick(n, (b.mn[0] + b.mx[0]) / 2);
  });
  if (picked.length === 0) throw new Error(`splitBaseMeshes: "${model.id}" picked no mesh nodes from ${model.src}`);

  // overall world bounds → normalization (feet on y=0, centered, height 1)
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (const n of picked) {
    const b = worldBounds(n);
    for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], b.mn[i]); mx[i] = Math.max(mx[i], b.mx[i]); }
  }
  const height = mx[1] - mn[1];
  const s = 1 / height;
  const center = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];

  // new document: one root carrying the normalization, one child per picked
  // mesh node with its baked world matrix; geometry is shared by reference
  // and copied across by the document merge below.
  const out = new Document();
  const outRoot = out.createNode(`basemesh:${model.id}`).setScale([s, s, s]).setTranslation([-center[0] * s, -center[1] * s, -center[2] * s]);
  const scene = out.createScene(model.id).addChild(outRoot);
  let tris = 0;
  for (const n of picked) {
    const mesh = out.createMesh(n.getName());
    for (const prim of n.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      const copyAcc = (a) => out.createAccessor(a.getName()).setType(a.getType()).setArray(a.getArray().slice()).setBuffer(out.getRoot().listBuffers()[0] ?? out.createBuffer());
      const p = out.createPrimitive().setMode(prim.getMode()).setAttribute('POSITION', copyAcc(pos));
      const nrm = prim.getAttribute('NORMAL');
      if (nrm) p.setAttribute('NORMAL', copyAcc(nrm));
      if (idx) p.setIndices(copyAcc(idx));
      tris += (idx ? idx.getCount() : pos.getCount()) / 3;
      mesh.addPrimitive(p);
    }
    const child = out.createNode(n.getName()).setMesh(mesh);
    child.setMatrix(n.getWorldMatrix());
    outRoot.addChild(child);
  }
  await out.transform(prune());
  const file = path.join(OUT_DIR, `${model.id}.glb`);
  await io.write(file, out);
  const bytes = fs.statSync(file).size;
  manifest.push({ id: model.id, nodes: picked.length, tris: Math.round(tris), sourceHeight: +height.toFixed(3), bytes });
  console.log(`${model.id.padEnd(20)} nodes=${String(picked.length).padStart(2)} tris=${String(Math.round(tris)).padStart(7)} srcHeight=${height.toFixed(2)} → ${(bytes / 1024).toFixed(0)} KB`);
}
fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
